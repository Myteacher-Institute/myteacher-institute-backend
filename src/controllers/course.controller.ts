import { Request, Response } from "express";
import mongoose from "mongoose";
import { Course } from "../models/course.model";
import { Instructor } from "../models/instructor.model";
import { CourseAnalytics } from "../models/course-analytics.model";
import { AddCourseReqBody, AddCourseResT, FetchCoursesByUserResT, FetchAllCoursesResT, BrowseCoursesResT, EditCourseReqBody, EditCourseResT, FetchCourseByIdResT, CoursePreviewResT } from "../types";
import { addCourseValidation } from "../services";
import { google } from "googleapis";
import bcrypt from "bcryptjs";
import { emitToUser } from "../config/socket";

// Flatten the per-chapter content back into the legacy top-level arrays so the
// rest of the system (previews, browse, dashboards, deletion) keeps working
// with a single source of truth: the chapters array.
const flattenCourseChapters = (chapters: any[] = []) => {
    const videos: any[] = [];
    const programmingCodes: any[] = [];
    const assets: any[] = [];
    const quizzes: any[] = [];

    for (const chapter of chapters) {
        videos.push(...(chapter?.videos || []));
        programmingCodes.push(...(chapter?.programmingCodes || []));
        assets.push(...(chapter?.assets || []));
        quizzes.push(...(chapter?.quizzes || []));
    }

    return { videos, programmingCodes, assets, quizzes };
};

const stripHtml = (html: string = "") =>
    (html || "")
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

const handleAddCourse = async (req: Request<{}, {}, AddCourseReqBody>, res: Response<AddCourseResT>) => {
    try {
        const instructorId = req.userId;

        // Validate request body and instructor ID
        const validation = addCourseValidation(req.body, instructorId);
        if (!validation.isValid) {
            return res.status(instructorId ? 400 : 401).json({
                status: "failed",
                message: validation.message
            });
        }

        const { courseName, description, chapters, courseVideos, courseRequirements, price, duration, certificate, programmingCodes, assets, quizzes } = req.body;

        // Get instructor details from the database
        const instructor = await Instructor.findById(instructorId);

        if (!instructor) {
            return res.status(404).json({
                status: "failed",
                message: "Instructor not found"
            });
        }

        // Chapters are the source of truth; the flat arrays below are kept in
        // sync as a flattened aggregate for backward compatibility.
        const chaptersToStore = chapters || [];
        const flattened = flattenCourseChapters(chaptersToStore);

        // Create new course
        const newCourse = await Course.create({
            courseName,
            description,
            chapters: chaptersToStore,
            courseVideos: courseVideos !== undefined ? courseVideos : flattened.videos,
            programmingCodes: programmingCodes !== undefined ? programmingCodes : flattened.programmingCodes,
            assets: assets !== undefined ? assets : flattened.assets,
            quizzes: quizzes !== undefined ? quizzes : flattened.quizzes,
            courseRequirements: courseRequirements || [],
            appliedUsers: [],
            price,
            duration,
            certificate,
            instructorDetails: {
                userId: instructor._id,
                name: instructor.name,
                email: instructor.email,
                profilePicture: instructor.profilePicture
            }
        });

        // Emit real-time update to instructor
        if (instructorId) {
            emitToUser(instructorId, 'course:created', {
                courseId: newCourse._id,
                courseName: newCourse.courseName,
                createdAt: new Date()
            });
        }

        // Invalidate cache for this instructor
        const { cacheDelPattern } = await import('../config/redis');
        await cacheDelPattern(`instructor:${instructorId}:*`);
        await cacheDelPattern('courses:all'); // Invalidate all courses cache

        return res.status(201).json({
            status: "success",
            message: "Course created successfully",
            course: newCourse
        });

    } catch (error) {
        console.error('Add course error --->', (error as Error)?.message ?? error);
        res.status(500).json({
            status: "failed",
            message: "Internal server error"
        });
    }
};

const handleCourseEdit = async (req: Request<{ courseId: string }, {}, EditCourseReqBody>, res: Response<EditCourseResT>) => {
    try {
        const instructorId = req.userId;
        const { courseId } = req.params;

        if (!instructorId) {
            return res.status(401).json({
                status: "failed",
                message: "Unauthorized: Instructor ID not found"
            });
        }

        if (!courseId) {
            return res.status(400).json({
                status: "failed",
                message: "Course ID is required"
            });
        }

        // Find the course
        const course = await Course.findById(courseId);

        if (!course) {
            return res.status(404).json({
                status: "failed",
                message: "Course not found"
            });
        }

        // Verify that the instructor owns this course
        if (course.instructorDetails.userId.toString() !== instructorId) {
            return res.status(403).json({
                status: "failed",
                message: "You are not authorized to edit this course"
            });
        }

        // Get instructor for OAuth tokens
        const instructor = await Instructor.findById(instructorId);
        if (!instructor) {
            return res.status(404).json({
                status: "failed",
                message: "Instructor not found"
            });
        }

        // Update course with provided fields
        const { courseName, description, chapters, courseVideos, courseRequirements, price, duration, certificate, programmingCodes, assets, quizzes } = req.body;

        // Chapters are the source of truth; derive the flat aggregate arrays
        // from them so external-service deletions and legacy consumers keep
        // working. When chapters aren't provided (old clients) the flat fields
        // are used directly.
        const flattenedFromChapters = chapters !== undefined ? flattenCourseChapters(chapters) : null;
        const effectiveVideos = flattenedFromChapters ? flattenedFromChapters.videos : courseVideos;
        const effectiveAssets = flattenedFromChapters ? flattenedFromChapters.assets : assets;
        const effectiveCodes = flattenedFromChapters ? flattenedFromChapters.programmingCodes : programmingCodes;
        const effectiveQuizzes = flattenedFromChapters ? flattenedFromChapters.quizzes : quizzes;

        // Track errors for frontend display
        const deletionErrors: string[] = [];

        // Handle YouTube video deletions
        if (effectiveVideos !== undefined) {
            const oldVideoUrls = course.courseVideos?.map((v: any) => v.videoUrl) || [];
            const newVideoUrls = effectiveVideos.map((v: any) => v.videoUrl);
            const deletedVideos = oldVideoUrls.filter((url: string) => !newVideoUrls.includes(url));

            if (deletedVideos.length > 0 && instructor.youtubeTokens) {
                const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
                const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
                const redirectUri = process.env.GOOGLE_DRIVE_REDIRECT_URI;

                if (clientId && clientSecret && redirectUri) {
                    try {
                        const oauth2Client = new google.auth.OAuth2(
                            clientId,
                            clientSecret,
                            redirectUri
                        );

                        oauth2Client.setCredentials({
                            access_token: instructor.youtubeTokens.accessToken,
                            refresh_token: instructor.youtubeTokens.refreshToken
                        });

                        // Check if token needs refresh
                        if (instructor.youtubeTokens.expiryDate && Date.now() > instructor.youtubeTokens.expiryDate) {
                            try {
                                const { credentials } = await oauth2Client.refreshAccessToken();
                                if (credentials.access_token) {
                                    instructor.youtubeTokens.accessToken = credentials.access_token;
                                    if (credentials.expiry_date) {
                                        instructor.youtubeTokens.expiryDate = typeof credentials.expiry_date === 'number' ? credentials.expiry_date : Date.parse(String(credentials.expiry_date));
                                    }
                                    await instructor.save();
                                }
                            } catch (refreshError: any) {
                                const errorMsg = `YouTube token refresh failed: ${refreshError.message}. Please re-authenticate with YouTube.`;
                                console.error(errorMsg);
                                deletionErrors.push(errorMsg);
                            }
                        }

                        const youtube = google.youtube({ version: "v3", auth: oauth2Client });

                        for (const videoUrl of deletedVideos) {
                            try {
                                const match = videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/);
                                if (match) {
                                    const videoId = match[1];
                                    await youtube.videos.delete({ id: videoId });
                                    console.log(`Successfully deleted YouTube video: ${videoId}`);
                                }
                            } catch (error: any) {
                                const errorMsg = `Failed to delete YouTube video ${videoUrl}: ${error.message || error}. The video remains on YouTube.`;
                                console.error(errorMsg);
                                deletionErrors.push(errorMsg);
                            }
                        }
                    } catch (authError: any) {
                        const errorMsg = `YouTube authentication error: ${authError.message}. Please re-authenticate with YouTube to delete videos.`;
                        console.error(errorMsg);
                        deletionErrors.push(errorMsg);
                    }
                } else {
                    deletionErrors.push("YouTube OAuth credentials not configured. Videos cannot be deleted from YouTube.");
                }
            } else if (deletedVideos.length > 0) {
                deletionErrors.push("No YouTube tokens found. Please authenticate with YouTube to delete videos.");
            }

            course.courseVideos = effectiveVideos;
        }

        // Handle Google Drive asset deletions
        if (effectiveAssets !== undefined) {
            const oldAssetUrls = course.assets?.map((a: any) => a.url) || [];
            const newAssetUrls = effectiveAssets.map((a: any) => a.url);
            const deletedAssets = oldAssetUrls.filter((url: string) => !newAssetUrls.includes(url));

            if (deletedAssets.length > 0 && instructor.driveTokens) {
                const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
                const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
                const redirectUri = process.env.GOOGLE_DRIVE_REDIRECT_URI;

                if (clientId && clientSecret && redirectUri) {
                    try {
                        const oauth2Client = new google.auth.OAuth2(
                            clientId,
                            clientSecret,
                            redirectUri
                        );

                        oauth2Client.setCredentials({
                            access_token: instructor.driveTokens.accessToken,
                            refresh_token: instructor.driveTokens.refreshToken
                        });

                        // Check if token needs refresh
                        if (instructor.driveTokens.expiryDate && Date.now() > instructor.driveTokens.expiryDate) {
                            try {
                                const { credentials } = await oauth2Client.refreshAccessToken();
                                if (credentials.access_token) {
                                    instructor.driveTokens.accessToken = credentials.access_token;
                                    if (credentials.expiry_date) {
                                        instructor.driveTokens.expiryDate = typeof credentials.expiry_date === 'number' ? credentials.expiry_date : Date.parse(String(credentials.expiry_date));
                                    }
                                    await instructor.save();
                                }
                            } catch (refreshError: any) {
                                const errorMsg = `Drive token refresh failed: ${refreshError.message}. Please re-authenticate with Google Drive.`;
                                console.error(errorMsg);
                                deletionErrors.push(errorMsg);
                            }
                        }

                        const drive = google.drive({ version: "v3", auth: oauth2Client });

                        for (const assetUrl of deletedAssets) {
                            try {
                                const match = assetUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
                                if (match) {
                                    const fileId = match[1];
                                    await drive.files.delete({ fileId: fileId });
                                    console.log(`Successfully deleted Drive asset: ${fileId}`);
                                }
                            } catch (error: any) {
                                const errorMsg = `Failed to delete Drive asset ${assetUrl}: ${error.message || error}. The asset remains on Google Drive.`;
                                console.error(errorMsg);
                                deletionErrors.push(errorMsg);
                            }
                        }
                    } catch (authError: any) {
                        const errorMsg = `Drive authentication error: ${authError.message}. Please re-authenticate with Google Drive to delete assets.`;
                        console.error(errorMsg);
                        deletionErrors.push(errorMsg);
                    }
                } else {
                    deletionErrors.push("Google Drive OAuth credentials not configured. Assets cannot be deleted from Drive.");
                }
            } else if (deletedAssets.length > 0) {
                deletionErrors.push("No Drive tokens found. Please authenticate with Google Drive to delete assets.");
            }

            course.assets = effectiveAssets;
        }

        if (chapters !== undefined) course.chapters = chapters;
        if (courseName !== undefined) course.courseName = courseName;
        if (description !== undefined) course.description = description;
        if (courseRequirements !== undefined) course.courseRequirements = courseRequirements;
        if (price !== undefined) course.price = price;
        if (duration !== undefined) course.duration = duration;
        if (certificate !== undefined) course.certificate = certificate;
        if (effectiveCodes !== undefined) course.programmingCodes = effectiveCodes;
        if (effectiveQuizzes !== undefined) course.quizzes = effectiveQuizzes;

        const updatedCourse = await course.save();

        // Emit real-time update to instructor
        emitToUser(instructorId, 'course:updated', {
            courseId: updatedCourse._id,
            courseName: updatedCourse.courseName,
            updatedAt: new Date()
        });

        // Invalidate cache for this instructor
        const { cacheDelPattern } = await import('../config/redis');
        await cacheDelPattern(`instructor:${instructorId}:*`);
        await cacheDelPattern('courses:all'); // Invalidate all courses cache
        await cacheDelPattern(`course:${courseId}`); // Invalidate specific course cache

        return res.status(200).json({
            status: "success",
            message: deletionErrors.length > 0 
                ? "Course updated successfully, but some resources could not be deleted from external services." 
                : "Course updated successfully",
            course: updatedCourse,
            deletionErrors: deletionErrors.length > 0 ? deletionErrors : undefined
        });

    } catch (error) {
        console.error('Edit course error --->', (error as Error)?.message ?? error);
        res.status(500).json({
            status: "failed",
            message: "Internal server error"
        });
    }
};

const handleFetchCourseById = async (req: Request<{ courseId: string }>, res: Response<FetchCourseByIdResT>) => {
    try {
        const { courseId } = req.params;

        if (!courseId) {
            return res.status(400).json({
                status: "failed",
                message: "Course ID is required"
            });
        }

        const { cacheGet, cacheSet } = await import('../config/redis');
        const cacheKey = `course:${courseId}`;

        // Try to get from cache first
        const cachedCourse = await cacheGet(cacheKey);
        if (cachedCourse) {
            console.log('📦 Serving course from cache');
            return res.status(200).json({
                status: "success",
                message: "Course fetched successfully",
                course: cachedCourse
            });
        }

        const course = await Course.findById(courseId).lean();

        if (!course) {
            return res.status(404).json({
                status: "failed",
                message: "Course not found"
            });
        }

        // Cache the result for 10 minutes (600 seconds)
        await cacheSet(cacheKey, course, 600);

        return res.status(200).json({
            status: "success",
            message: "Course fetched successfully",
            course
        });

    } catch (error) {
        console.error('Fetch course by ID error --->', (error as Error)?.message ?? error);
        res.status(500).json({
            status: "failed",
            message: "Internal server error"
        });
    }
};

const handleFetchCoursePreview = async (req: Request<{ courseId: string }>, res: Response<CoursePreviewResT>) => {
    try {
        const { courseId } = req.params;

        if (!courseId) {
            return res.status(400).json({
                status: "failed",
                message: "Course ID is required"
            });
        }

        const { cacheGet, cacheSet } = await import('../config/redis');
        const cacheKey = `course:${courseId}:preview`;

        // Try to get from cache first
        const cachedCourse = await cacheGet(cacheKey);
        if (cachedCourse) {
            console.log('📦 Serving course preview from cache');
            return res.status(200).json({
                status: "success",
                message: "Course fetched successfully",
                course: cachedCourse
            });
        }

        const course = await Course.findById(courseId).lean();

        if (!course) {
            return res.status(404).json({
                status: "failed",
                message: "Course not found"
            });
        }

        // Only expose preview videos — never the full course content.
        const previewVideos = (course.courseVideos || [])
            .filter((video) => video.isPreview)
            .map((video) => ({
                videoUrl: video.videoUrl,
                videoTitle: video.videoTitle,
                videoDuration: video.videoDuration,
            }));

        const mappedCourse = {
            _id: String(course._id),
            courseName: course.courseName,
            description: stripHtml(course.description),
            price: course.price,
            duration: course.duration,
            certificate: course.certificate,
            courseRequirements: course.courseRequirements ?? [],
            ratings: course.ratings ?? [],
            averageRating: course.averageRating ?? 0,
            instructorName: course.instructorDetails?.name || undefined,
            lessons: (course.courseVideos ?? []).length,
            previewThumbnail: getYouTubeThumbnail(previewVideos[0]?.videoUrl),
            previewVideos,
            appliedUsers: course.appliedUsers ?? [],
        };

        // Cache the result for 10 minutes (600 seconds)
        await cacheSet(cacheKey, mappedCourse, 600);

        return res.status(200).json({
            status: "success",
            message: "Course fetched successfully",
            course: mappedCourse
        });

    } catch (error) {
        console.error('Fetch course preview error --->', (error as Error)?.message ?? error);
        res.status(500).json({
            status: "failed",
            message: "Internal server error"
        });
    }
};

const handleFetchCoursesByAppliedUser = async (req: Request, res: Response<FetchCoursesByUserResT>) => {
    try {
        const userId = req.userId;

        if (!userId) {
            return res.status(401).json({
                status: "failed",
                message: "Unauthorized: User ID not found"
            });
        }

        const { cacheGet, cacheSet } = await import('../config/redis');
        const cacheKey = `user:${userId}:courses`;

        // Try to get from cache first
        const cachedCourses = await cacheGet(cacheKey);
        if (cachedCourses) {
            console.log('📦 Serving user courses from cache');
            return res.status(200).json({
                status: "success",
                message: "Courses fetched successfully",
                courses: cachedCourses
            });
        }

        // Fetch courses where the user is in appliedUsers
        const courses = await Course.find({
            "appliedUsers.userId": userId
        }).lean();

        // Cache the result for 5 minutes (300 seconds)
        await cacheSet(cacheKey, courses, 300);

        return res.status(200).json({
            status: "success",
            message: "Courses fetched successfully",
            courses
        });

    } catch (error) {
        console.error('Fetch courses by applied user error --->', (error as Error)?.message ?? error);
        res.status(500).json({
            status: "failed",
            message: "Internal server error"
        });
    }
};

const handleFetchAllCourses = async (req: Request, res: Response<FetchAllCoursesResT>) => {
    try {
        const { cacheGet, cacheSet } = await import('../config/redis');
        const cacheKey = 'courses:all';

        // Try to get from cache first
        const cachedCourses = await cacheGet(cacheKey);
        if (cachedCourses) {
            console.log('📦 Serving all courses from cache');
            return res.status(200).json({
                status: "success",
                message: "All courses fetched successfully",
                courses: cachedCourses
            });
        }

        // Fetch all courses excluding courseVideos, chapters and certificate
        const courses = await Course.find({}, {
            courseVideos: 0,
            chapters: 0,
            certificate: 0
        }).lean();

        // Cache the result for 3 minutes (180 seconds) - shorter since this is public data
        await cacheSet(cacheKey, courses, 180);

        return res.status(200).json({
            status: "success",
            message: "All courses fetched successfully",
            courses
        });

    } catch (error) {
        console.error('Fetch all courses error --->', (error as Error)?.message ?? error);
        res.status(500).json({
            status: "failed",
            message: "Internal server error"
        });
    }
};

// Keywords used to match the frontend filter pills against course names. The
// Course model has no category field, so categories are inferred from titles.
const CATEGORY_KEYWORDS: Record<string, RegExp[]> = {
    Software: [/web/i, /javascript/i, /react/i, /node/i, /mern/i, /full.?stack/i, /programming/i, /development/i, /coding/i, /software/i, /python/i, /java/i],
    Data: [/data/i, /machine learning/i, /statistics/i, /analytics/i, /python/i, /sql/i],
    Design: [/design/i, /ui\/?ux/i, /figma/i, /adobe/i, /creative/i, /interface/i, /experience/i],
    Basics: [/intro/i, /basics/i, /basic/i, /beginner/i, /fundamental/i, /start/i, /first steps/i],
};

// Extract a YouTube thumbnail from a video URL ('' when not a YouTube link).
const getYouTubeThumbnail = (videoUrl?: string): string => {
    if (!videoUrl) return '';
    const match = videoUrl.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([\w-]{11})/);
    return match ? `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg` : '';
};

const handleBrowseCourses = async (req: Request, res: Response<BrowseCoursesResT>) => {
    try {
        const page = Math.max(parseInt(String(req.query.page), 10) || 1, 1);
        const limit = Math.min(Math.max(parseInt(String(req.query.limit), 10) || 9, 1), 24);
        const search = String(req.query.search ?? '').trim();
        const category = String(req.query.category ?? 'All').trim() || 'All';

        // Only courses that expose at least one preview video.
        const conditions: Record<string, unknown>[] = [{ 'courseVideos.isPreview': true }];

        if (search) {
            conditions.push({
                $or: [
                    { courseName: { $regex: search, $options: 'i' } },
                    { description: { $regex: search, $options: 'i' } },
                ],
            });
        }

        if (category !== 'All') {
            const keywords = CATEGORY_KEYWORDS[category];
            if (keywords?.length) {
                conditions.push({ $or: keywords.map((kw) => ({ courseName: { $regex: kw } })) });
            }
        }

        const match = conditions.length > 1 ? { $and: conditions } : conditions[0];

        const total = await Course.countDocuments(match);

        const courses = await Course.aggregate([
            { $match: match },
            { $sort: { createdAt: -1 } },
            { $skip: (page - 1) * limit },
            { $limit: limit },
            {
                $addFields: {
                    lessons: { $size: { $ifNull: ['$courseVideos', []] } },
                    firstPreviewUrl: {
                        $arrayElemAt: [
                            {
                                $map: {
                                    input: {
                                        $filter: {
                                            input: { $ifNull: ['$courseVideos', []] },
                                            as: 'v',
                                            cond: '$$v.isPreview',
                                        },
                                    },
                                    as: 'pv',
                                    in: '$$pv.videoUrl',
                                },
                            },
                            0,
                        ],
                    },
                },
            },
            {
                $project: {
                    courseName: 1,
                    description: 1,
                    price: 1,
                    duration: 1,
                    courseRequirements: 1,
                    ratings: 1,
                    averageRating: 1,
                    instructorName: { $ifNull: ['$instructorDetails.name', ''] },
                    lessons: 1,
                    previewVideoUrl: { $ifNull: ['$firstPreviewUrl', ''] },
                },
            },
        ]);

        const mappedCourses = courses.map((course) => ({
            _id: String(course._id),
            courseName: course.courseName,
            description: stripHtml(course.description),
            price: course.price,
            duration: course.duration,
            courseRequirements: course.courseRequirements ?? [],
            ratings: course.ratings ?? [],
            averageRating: course.averageRating ?? 0,
            instructorName: course.instructorName || undefined,
            lessons: course.lessons ?? 0,
            previewThumbnail: getYouTubeThumbnail(course.previewVideoUrl),
        }));

        const totalPages = Math.ceil(total / limit);

        return res.status(200).json({
            status: "success",
            message: "Courses fetched successfully",
            courses: mappedCourses,
            pagination: {
                page,
                limit,
                total,
                totalPages,
                hasMore: page < totalPages,
            },
        });

    } catch (error) {
        console.error('Browse courses error --->', (error as Error)?.message ?? error);
        res.status(500).json({
            status: "failed",
            message: "Internal server error"
        });
    }
};

const handleFetchCoursesByInstructor = async (req: Request, res: Response) => {
    try {
        const instructorId = req.userId;

        if (!instructorId) {
            return res.status(401).json({
                status: "failed",
                message: "Unauthorized: Instructor ID not found"
            });
        }

        const { cacheGet, cacheSet } = await import('../config/redis');
        const cacheKey = `instructor:${instructorId}:courses`;

        // Try to get from cache first
        const cachedCourses = await cacheGet(cacheKey);
        if (cachedCourses) {
            console.log('📦 Serving courses from cache');
            return res.status(200).json({
                status: "success",
                message: "Instructor courses fetched successfully",
                courses: cachedCourses
            });
        }

        // Fetch courses created by this instructor with optimized query
        const courses = await Course.find({
            "instructorDetails.userId": instructorId
        }, {
            certificate: 0
        }).lean().sort({ createdAt: -1 }); // Use lean() for performance and sort by newest first

        // Cache the result for 5 minutes (300 seconds)
        await cacheSet(cacheKey, courses, 300);

        return res.status(200).json({
            status: "success",
            message: "Instructor courses fetched successfully",
            courses
        });

    } catch (error) {
        console.error('Fetch courses by instructor error --->', (error as Error)?.message ?? error);
        res.status(500).json({
            status: "failed",
            message: "Internal server error"
        });
    }
};

const handleDeleteCourse = async (req: Request<{ courseId: string }>, res: Response) => {
    try {
        const instructorId = req.userId;
        const { courseId } = req.params;
        const { password } = req.body;

        if (!instructorId) {
            return res.status(401).json({
                status: "failed",
                message: "Unauthorized: Instructor ID not found"
            });
        }

        if (!courseId) {
            return res.status(400).json({
                status: "failed",
                message: "Course ID is required"
            });
        }

        if (!password) {
            return res.status(400).json({
                status: "failed",
                message: "Password is required"
            });
        }

        // Find the course
        const course = await Course.findById(courseId);

        if (!course) {
            return res.status(404).json({
                status: "failed",
                message: "Course not found"
            });
        }

        // Verify that the instructor owns this course
        if (course.instructorDetails.userId.toString() !== instructorId) {
            return res.status(403).json({
                status: "failed",
                message: "You are not authorized to delete this course"
            });
        }

        // Verify instructor password
        const instructor = await Instructor.findById(instructorId);
        if (!instructor) {
            return res.status(404).json({
                status: "failed",
                message: "Instructor not found"
            });
        }

        const isPasswordValid = await bcrypt.compare(password, instructor.password);
        if (!isPasswordValid) {
            return res.status(401).json({
                status: "failed",
                message: "Invalid password"
            });
        }

        // Delete YouTube videos
        if (course.courseVideos && course.courseVideos.length > 0) {
            const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
            const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
            const redirectUri = process.env.GOOGLE_DRIVE_REDIRECT_URI;

            if (instructor.youtubeTokens && clientId && clientSecret && redirectUri) {
                const oauth2Client = new google.auth.OAuth2(
                    clientId,
                    clientSecret,
                    redirectUri
                );

                oauth2Client.setCredentials({
                    access_token: instructor.youtubeTokens.accessToken,
                    refresh_token: instructor.youtubeTokens.refreshToken
                });

                // Check if token needs refresh
                if (instructor.youtubeTokens.expiryDate && Date.now() > instructor.youtubeTokens.expiryDate) {
                    const { credentials } = await oauth2Client.refreshAccessToken();
                    if (credentials.access_token) {
                        instructor.youtubeTokens.accessToken = credentials.access_token;
                        if (credentials.expiry_date) {
                            instructor.youtubeTokens.expiryDate = typeof credentials.expiry_date === 'number' ? credentials.expiry_date : Date.parse(String(credentials.expiry_date));
                        }
                        await instructor.save();
                    }
                }

                const youtube = google.youtube({ version: "v3", auth: oauth2Client });

                for (const video of course.courseVideos) {
                    if (video.videoUrl) {
                        try {
                            // Extract video ID from URL
                            const match = video.videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/);
                            if (match) {
                                const videoId = match[1];
                                await youtube.videos.delete({
                                    id: videoId
                                });
                            }
                        } catch (error) {
                            console.error(`Failed to delete YouTube video ${video.videoUrl}:`, error);
                            // Continue with other videos even if one fails
                        }
                    }
                }
            }
        }

        // Delete Google Drive assets
        if (course.assets && course.assets.length > 0) {
            const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
            const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
            const redirectUri = process.env.GOOGLE_DRIVE_REDIRECT_URI;

            if (instructor.driveTokens && clientId && clientSecret && redirectUri) {
                const oauth2Client = new google.auth.OAuth2(
                    clientId,
                    clientSecret,
                    redirectUri
                );

                oauth2Client.setCredentials({
                    access_token: instructor.driveTokens.accessToken,
                    refresh_token: instructor.driveTokens.refreshToken
                });

                // Check if token needs refresh
                if (instructor.driveTokens.expiryDate && Date.now() > instructor.driveTokens.expiryDate) {
                    const { credentials } = await oauth2Client.refreshAccessToken();
                    if (credentials.access_token) {
                        instructor.driveTokens.accessToken = credentials.access_token;
                        if (credentials.expiry_date) {
                            instructor.driveTokens.expiryDate = typeof credentials.expiry_date === 'number' ? credentials.expiry_date : Date.parse(String(credentials.expiry_date));
                        }
                        await instructor.save();
                    }
                }

                const drive = google.drive({ version: "v3", auth: oauth2Client });

                for (const asset of course.assets) {
                    if (asset.url) {
                        try {
                            // Extract file ID from Google Drive URL
                            const match = asset.url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
                            if (match) {
                                const fileId = match[1];
                                await drive.files.delete({
                                    fileId: fileId
                                });
                            }
                        } catch (error) {
                            console.error(`Failed to delete Drive asset ${asset.url}:`, error);
                            // Continue with other assets even if one fails
                        }
                    }
                }
            }
        }

        // Delete the course from database
        await Course.findByIdAndDelete(courseId);

        // Emit real-time update to instructor
        emitToUser(instructorId, 'course:deleted', {
            courseId: courseId,
            deletedAt: new Date()
        });

        // Invalidate cache for this instructor
        const { cacheDelPattern } = await import('../config/redis');
        await cacheDelPattern(`instructor:${instructorId}:*`);
        await cacheDelPattern('courses:all'); // Invalidate all courses cache
        await cacheDelPattern(`course:${courseId}`); // Invalidate specific course cache

        return res.status(200).json({
            status: "success",
            message: "Course deleted successfully"
        });

    } catch (error) {
        console.error('Delete course error --->', (error as Error)?.message ?? error);
        res.status(500).json({
            status: "failed",
            message: "Internal server error"
        });
    }
};

const handleAddRating = async (req: Request<{ courseId: string }, {}, { rating: number; comment: string }>, res: Response) => {
    try {
        const userId = req.userId;
        const { courseId } = req.params;
        const { rating, comment } = req.body;

        if (!userId) {
            return res.status(401).json({
                status: "failed",
                message: "Unauthorized: User ID not found"
            });
        }

        if (!courseId) {
            return res.status(400).json({
                status: "failed",
                message: "Course ID is required"
            });
        }

        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({
                status: "failed",
                message: "Rating must be between 1 and 5"
            });
        }

        // Find the course
        const course = await Course.findById(courseId);

        if (!course) {
            return res.status(404).json({
                status: "failed",
                message: "Course not found"
            });
        }

        // Check if user has enrolled in the course
        const hasEnrolled = course.appliedUsers?.some((user: any) => user.userId.toString() === userId);
        if (!hasEnrolled) {
            return res.status(403).json({
                status: "failed",
                message: "You must enroll in this course before rating it"
            });
        }

        // Check if user has already rated this course
        const hasRated = course.ratings?.some((r: any) => r.userId.toString() === userId);
        if (hasRated) {
            return res.status(400).json({
                status: "failed",
                message: "You have already rated this course"
            });
        }

        // Get user details - for now use a placeholder since user structure may vary
        const userName = "Student";

        // Add the rating
        const newRating = {
            userId: new mongoose.Types.ObjectId(userId),
            userName,
            rating,
            comment: comment || "",
            ratedAt: new Date()
        };

        course.ratings = course.ratings || [];
        course.ratings.push(newRating);

        // Calculate new average rating
        const totalRating = course.ratings.reduce((sum: number, r: any) => sum + r.rating, 0);
        course.averageRating = Number((totalRating / course.ratings.length).toFixed(1));

        await course.save();

        // Emit real-time update to instructor
        emitToUser(course.instructorDetails.userId.toString(), 'course:rated', {
            courseId: course._id,
            courseName: course.courseName,
            averageRating: course.averageRating,
            ratedBy: userId,
            ratedAt: new Date()
        });

        res.status(200).json({
            status: "success",
            message: "Rating added successfully",
            averageRating: course.averageRating
        });

    } catch (error) {
        console.error('Add rating error --->', (error as Error)?.message ?? error);
        res.status(500).json({
            status: "failed",
            message: "Internal server error"
        });
    }
};

const handleInstructorStatistics = async (req: Request, res: Response) => {
    try {
        const instructorId = req.userId;

        if (!instructorId) {
            return res.status(401).json({
                status: "failed",
                message: "Unauthorized: Instructor ID not found"
            });
        }

        const { cacheGet, cacheSet } = await import('../config/redis');
        const cacheKey = `instructor:${instructorId}:statistics`;

        // Try to get from cache first
        const cachedStats = await cacheGet(cacheKey);
        if (cachedStats) {
            console.log('📦 Serving statistics from cache');
            return res.status(200).json({
                status: "success",
                statistics: cachedStats
            });
        }

        // Get current date info for snapshot
        const now = new Date();
        const currentMonth = now.toISOString().slice(0, 7); // Format: "2024-01"
        const currentYear = now.getFullYear();
        
        // Get previous month info
        const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const prevMonth = prevMonthDate.toISOString().slice(0, 7);
        const prevYear = prevMonthDate.getFullYear();

        // Fetch instructor's moneyMade field (the authoritative source for earnings)
        const instructor = await Instructor.findById(instructorId).select('moneyMade').lean();
        const totalEarnings = instructor?.moneyMade || 0;

        // Fetch only the fields we need for calculations (much faster)
        const courses = await Course.find(
            { 'instructorDetails.userId': instructorId },
            { price: 1, appliedUsers: 1, averageRating: 1 }
        ).lean(); // Use lean() for faster queries

        // Calculate total students across all courses
        const totalStudents = courses.reduce((sum, course) => {
            return sum + (course.appliedUsers?.length || 0);
        }, 0);

        // Total courses
        const totalCourses = courses.length;

        // Calculate average rating from courses
        const averageRating = courses.length > 0 
            ? Number((courses.reduce((sum, course) => sum + (course.averageRating || 0), 0) / courses.length).toFixed(1))
            : 0;

        // Run analytics update in background (non-blocking)
        CourseAnalytics.findOneAndUpdate(
            { instructorId, month: currentMonth, year: currentYear },
            {
                instructorId,
                month: currentMonth,
                year: currentYear,
                totalStudents,
                totalCourses,
                totalEarnings,
                averageRating
            },
            { upsert: true, returnDocument: 'after' }
        ).catch(err => console.error('Analytics update error:', err));

        // Get previous month snapshot for trend calculation (cached)
        const prevMonthStats = await CourseAnalytics.findOne({
            instructorId,
            month: prevMonth,
            year: prevYear
        }).lean();

        // Calculate trends
        const calculateTrend = (current: number, previous: number): string => {
            if (!previous || previous === 0) return "0%";
            const change = ((current - previous) / previous) * 100;
            return `${change > 0 ? '+' : ''}${change.toFixed(1)}%`;
        };

        const studentsTrend = calculateTrend(totalStudents, prevMonthStats?.totalStudents || 0);
        const coursesTrend = calculateTrend(totalCourses, prevMonthStats?.totalCourses || 0);
        const earningsTrend = calculateTrend(totalEarnings, prevMonthStats?.totalEarnings || 0);
        const ratingTrend = calculateTrend(averageRating, prevMonthStats?.averageRating || 0);

        const statistics = {
            totalStudents: totalStudents.toLocaleString(),
            totalCourses,
            totalEarnings: `₦${totalEarnings.toLocaleString()}`,
            averageRating,
            trends: { students: studentsTrend, courses: coursesTrend, earnings: earningsTrend, rating: ratingTrend }
        };

        // Cache the result for 2 minutes (120 seconds) - shorter than courses since stats change more frequently
        await cacheSet(cacheKey, statistics, 120);

        return res.status(200).json({
            status: "success",
            statistics
        });

    } catch (error) {
        console.error('Instructor statistics error --->', (error as Error)?.message ?? error);
        res.status(500).json({
            status: "failed",
            message: "Internal server error"
        });
    }
};

const handleInstructorReviews = async (req: Request, res: Response) => {
    try {
        const instructorId = req.userId;

        if (!instructorId) {
            return res.status(401).json({
                status: "failed",
                message: "Unauthorized: Instructor ID not found"
            });
        }

        // Fetch all courses for this instructor with their ratings
        const courses = await Course.find(
            { 'instructorDetails.userId': instructorId },
            {
                courseName: 1,
                ratings: 1,
                averageRating: 1
            }
        ).lean();

        // Flatten all reviews from all courses
        const allReviews: any[] = [];
        courses.forEach(course => {
            if (course.ratings && course.ratings.length > 0) {
                course.ratings.forEach((rating: any) => {
                    allReviews.push({
                        ...rating,
                        courseName: course.courseName,
                        courseId: course._id,
                        averageRating: course.averageRating
                    });
                });
            }
        });

        // Sort by most recent
        allReviews.sort((a, b) => {
            const dateA = new Date(a.ratedAt || 0);
            const dateB = new Date(b.ratedAt || 0);
            return dateB.getTime() - dateA.getTime();
        });

        return res.status(200).json({
            status: "success",
            reviews: allReviews,
            totalReviews: allReviews.length
        });

    } catch (error) {
        console.error('Instructor reviews error --->', (error as Error)?.message ?? error);
        res.status(500).json({
            status: "failed",
            message: "Internal server error"
        });
    }
};

const handleRetryDeletion = async (req: Request<{ courseId: string }, {}, { videoUrls?: string[] }>, res: Response) => {
    try {
        const instructorId = req.userId;
        const { courseId } = req.params;
        const { videoUrls } = req.body;

        if (!instructorId) {
            return res.status(401).json({
                status: "failed",
                message: "Unauthorized: Instructor ID not found"
            });
        }

        if (!courseId) {
            return res.status(400).json({
                status: "failed",
                message: "Course ID is required"
            });
        }

        // Find the course
        const course = await Course.findById(courseId);

        if (!course) {
            return res.status(404).json({
                status: "failed",
                message: "Course not found"
            });
        }

        // Verify that the instructor owns this course
        if (course.instructorDetails.userId.toString() !== instructorId) {
            return res.status(403).json({
                status: "failed",
                message: "You are not authorized to edit this course"
            });
        }

        // Get instructor for OAuth tokens
        const instructor = await Instructor.findById(instructorId);
        if (!instructor) {
            return res.status(404).json({
                status: "failed",
                message: "Instructor not found"
            });
        }

        const deletionErrors: string[] = [];

        if (videoUrls && videoUrls.length > 0 && instructor.youtubeTokens) {
            const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
            const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
            const redirectUri = process.env.GOOGLE_DRIVE_REDIRECT_URI;

            if (clientId && clientSecret && redirectUri) {
                try {
                    const oauth2Client = new google.auth.OAuth2(
                        clientId,
                        clientSecret,
                        redirectUri
                    );

                    oauth2Client.setCredentials({
                        access_token: instructor.youtubeTokens.accessToken,
                        refresh_token: instructor.youtubeTokens.refreshToken
                    });

                    // Check if token needs refresh
                    if (instructor.youtubeTokens.expiryDate && Date.now() > instructor.youtubeTokens.expiryDate) {
                        try {
                            const { credentials } = await oauth2Client.refreshAccessToken();
                            if (credentials.access_token) {
                                instructor.youtubeTokens.accessToken = credentials.access_token;
                                if (credentials.expiry_date) {
                                    instructor.youtubeTokens.expiryDate = typeof credentials.expiry_date === 'number' ? credentials.expiry_date : Date.parse(String(credentials.expiry_date));
                                }
                                await instructor.save();
                            }
                        } catch (refreshError: any) {
                            const errorMsg = `YouTube token refresh failed: ${refreshError.message}. Please re-authenticate with YouTube.`;
                            console.error(errorMsg);
                            deletionErrors.push(errorMsg);
                        }
                    }

                    const youtube = google.youtube({ version: "v3", auth: oauth2Client });

                    for (const videoUrl of videoUrls) {
                        try {
                            const match = videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/);
                            if (match) {
                                const videoId = match[1];
                                await youtube.videos.delete({ id: videoId });
                                console.log(`Successfully deleted YouTube video: ${videoId}`);
                            }
                        } catch (error: any) {
                            const errorMsg = `Failed to delete YouTube video ${videoUrl}: ${error.message || error}. The video remains on YouTube.`;
                            console.error(errorMsg);
                            deletionErrors.push(errorMsg);
                        }
                    }
                } catch (authError: any) {
                    const errorMsg = `YouTube authentication error: ${authError.message}. Please re-authenticate with YouTube to delete videos.`;
                    console.error(errorMsg);
                    deletionErrors.push(errorMsg);
                }
            } else {
                deletionErrors.push("YouTube OAuth credentials not configured. Videos cannot be deleted from YouTube.");
            }
        }

        return res.status(200).json({
            status: "success",
            message: deletionErrors.length > 0 
                ? "Some resources could not be deleted from external services." 
                : "Resources deleted successfully",
            deletionErrors: deletionErrors.length > 0 ? deletionErrors : undefined
        });

    } catch (error) {
        console.error('Retry deletion error --->', (error as Error)?.message ?? error);
        res.status(500).json({
            status: "failed",
            message: "Internal server error"
        });
    }
};

const handleDeleteOnly = async (req: Request<{ courseId: string }, {}, EditCourseReqBody>, res: Response) => {
    try {
        const instructorId = req.userId;
        const { courseId } = req.params;

        if (!instructorId) {
            return res.status(401).json({
                status: "failed",
                message: "Unauthorized: Instructor ID not found"
            });
        }

        if (!courseId) {
            return res.status(400).json({
                status: "failed",
                message: "Course ID is required"
            });
        }

        // Find the course
        const course = await Course.findById(courseId);

        if (!course) {
            return res.status(404).json({
                status: "failed",
                message: "Course not found"
            });
        }

        // Verify that the instructor owns this course
        if (course.instructorDetails.userId.toString() !== instructorId) {
            return res.status(403).json({
                status: "failed",
                message: "You are not authorized to edit this course"
            });
        }

        // Get instructor for OAuth tokens
        const instructor = await Instructor.findById(instructorId);
        if (!instructor) {
            return res.status(404).json({
                status: "failed",
                message: "Instructor not found"
            });
        }

        const { courseVideos, assets } = req.body;
        const deletionErrors: string[] = [];

        // Handle YouTube video deletions
        if (courseVideos !== undefined) {
            const oldVideoUrls = course.courseVideos?.map((v: any) => v.videoUrl) || [];
            const newVideoUrls = courseVideos.map((v: any) => v.videoUrl);
            const deletedVideos = oldVideoUrls.filter((url: string) => !newVideoUrls.includes(url));

            if (deletedVideos.length > 0 && instructor.youtubeTokens) {
                const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
                const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
                const redirectUri = process.env.GOOGLE_DRIVE_REDIRECT_URI;

                if (clientId && clientSecret && redirectUri) {
                    try {
                        const oauth2Client = new google.auth.OAuth2(
                            clientId,
                            clientSecret,
                            redirectUri
                        );

                        oauth2Client.setCredentials({
                            access_token: instructor.youtubeTokens.accessToken,
                            refresh_token: instructor.youtubeTokens.refreshToken
                        });

                        // Check if token needs refresh
                        if (instructor.youtubeTokens.expiryDate && Date.now() > instructor.youtubeTokens.expiryDate) {
                            try {
                                const { credentials } = await oauth2Client.refreshAccessToken();
                                if (credentials.access_token) {
                                    instructor.youtubeTokens.accessToken = credentials.access_token;
                                    if (credentials.expiry_date) {
                                        instructor.youtubeTokens.expiryDate = typeof credentials.expiry_date === 'number' ? credentials.expiry_date : Date.parse(String(credentials.expiry_date));
                                    }
                                    await instructor.save();
                                }
                            } catch (refreshError: any) {
                                const errorMsg = `YouTube token refresh failed: ${refreshError.message}. Please re-authenticate with YouTube.`;
                                console.error(errorMsg);
                                deletionErrors.push(errorMsg);
                            }
                        }

                        const youtube = google.youtube({ version: "v3", auth: oauth2Client });

                        for (const videoUrl of deletedVideos) {
                            try {
                                const match = videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/);
                                if (match) {
                                    const videoId = match[1];
                                    await youtube.videos.delete({ id: videoId });
                                    console.log(`Successfully deleted YouTube video: ${videoId}`);
                                }
                            } catch (error: any) {
                                const errorMsg = `Failed to delete YouTube video ${videoUrl}: ${error.message || error}. The video remains on YouTube.`;
                                console.error(errorMsg);
                                deletionErrors.push(errorMsg);
                            }
                        }
                    } catch (authError: any) {
                        const errorMsg = `YouTube authentication error: ${authError.message}. Please re-authenticate with YouTube to delete videos.`;
                        console.error(errorMsg);
                        deletionErrors.push(errorMsg);
                    }
                } else {
                    deletionErrors.push("YouTube OAuth credentials not configured. Videos cannot be deleted from YouTube.");
                }
            } else if (deletedVideos.length > 0) {
                deletionErrors.push("No YouTube tokens found. Please authenticate with YouTube to delete videos.");
            }
        }

        // Handle Google Drive asset deletions
        if (assets !== undefined) {
            const oldAssetUrls = course.assets?.map((a: any) => a.url) || [];
            const newAssetUrls = assets.map((a: any) => a.url);
            const deletedAssets = oldAssetUrls.filter((url: string) => !newAssetUrls.includes(url));

            if (deletedAssets.length > 0 && instructor.driveTokens) {
                const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
                const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
                const redirectUri = process.env.GOOGLE_DRIVE_REDIRECT_URI;

                if (clientId && clientSecret && redirectUri) {
                    try {
                        const oauth2Client = new google.auth.OAuth2(
                            clientId,
                            clientSecret,
                            redirectUri
                        );

                        oauth2Client.setCredentials({
                            access_token: instructor.driveTokens.accessToken,
                            refresh_token: instructor.driveTokens.refreshToken
                        });

                        // Check if token needs refresh
                        if (instructor.driveTokens.expiryDate && Date.now() > instructor.driveTokens.expiryDate) {
                            try {
                                const { credentials } = await oauth2Client.refreshAccessToken();
                                if (credentials.access_token) {
                                    instructor.driveTokens.accessToken = credentials.access_token;
                                    if (credentials.expiry_date) {
                                        instructor.driveTokens.expiryDate = typeof credentials.expiry_date === 'number' ? credentials.expiry_date : Date.parse(String(credentials.expiry_date));
                                    }
                                    await instructor.save();
                                }
                            } catch (refreshError: any) {
                                const errorMsg = `Drive token refresh failed: ${refreshError.message}. Please re-authenticate with Google Drive.`;
                                console.error(errorMsg);
                                deletionErrors.push(errorMsg);
                            }
                        }

                        const drive = google.drive({ version: "v3", auth: oauth2Client });

                        for (const assetUrl of deletedAssets) {
                            try {
                                const match = assetUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
                                if (match) {
                                    const fileId = match[1];
                                    await drive.files.delete({ fileId: fileId });
                                    console.log(`Successfully deleted Drive asset: ${fileId}`);
                                }
                            } catch (error: any) {
                                const errorMsg = `Failed to delete Drive asset ${assetUrl}: ${error.message || error}. The asset remains on Google Drive.`;
                                console.error(errorMsg);
                                deletionErrors.push(errorMsg);
                            }
                        }
                    } catch (authError: any) {
                        const errorMsg = `Drive authentication error: ${authError.message}. Please re-authenticate with Google Drive to delete assets.`;
                        console.error(errorMsg);
                        deletionErrors.push(errorMsg);
                    }
                } else {
                    deletionErrors.push("Google Drive OAuth credentials not configured. Assets cannot be deleted from Drive.");
                }
            } else if (deletedAssets.length > 0) {
                deletionErrors.push("No Drive tokens found. Please authenticate with Google Drive to delete assets.");
            }
        }

        // Signal auth-related deletion failures so the frontend can prompt a
        // re-authentication modal instead of silently leaving resources behind.
        const isAuthFailure = (msg: string) => /re-authenticat|token refresh|unauthorized|invalid_grant|credential/i.test(msg);
        const youtubeReauth = deletionErrors.some((e) => /youtube/i.test(e) && isAuthFailure(e));
        const driveReauth = deletionErrors.some((e) => /drive/i.test(e) && isAuthFailure(e));

        return res.status(200).json({
            status: "success",
            message: deletionErrors.length > 0 
                ? "Some resources could not be deleted from external services." 
                : "Resources deleted successfully",
            deletionErrors: deletionErrors.length > 0 ? deletionErrors : undefined,
            ...((youtubeReauth || driveReauth) ? { reauth: { youtube: youtubeReauth, drive: driveReauth } } : {})
        });

    } catch (error) {
        console.error('Delete only error --->', (error as Error)?.message ?? error);
        res.status(500).json({
            status: "failed",
            message: "Internal server error"
        });
    }
};

export {
    handleAddCourse,
    handleCourseEdit,
    handleFetchCourseById,
    handleFetchCoursePreview,
    handleFetchCoursesByAppliedUser,
    handleFetchAllCourses,
    handleBrowseCourses,
    handleFetchCoursesByInstructor,
    handleDeleteCourse,
    handleRetryDeletion,
    handleDeleteOnly,
    handleAddRating,
    handleInstructorStatistics,
    handleInstructorReviews
};
