import fs from "fs";
import mongoose from "mongoose";
import { google } from "googleapis";
import { Course } from "../models/course.model";
import { CourseCreationJob, Instructor } from "../models";
import { emitToUser } from "../config/socket";
import type {
    ICourseCreationJob,
    CourseCreationPayload,
    ActiveCourseCreationJob,
    CourseCreationVideoFile,
    CourseCreationAssetFile,
} from "../types";

// Tracks job ids currently being driven by the in-process runner so a boot
// resume and an in-flight worker completion can't both start the same job.
const activeRuns = new Set<string>();

const emitProgress = (instructorId: string, job: {
    jobId: string;
    courseName: string;
    status: string;
    currentStage: string;
    currentIndex: number;
    total: number;
    progressPercent: number;
    error?: string;
    courseId?: mongoose.Types.ObjectId;
}) => {
    try {
        emitToUser(instructorId, 'course-creation:progress', {
            jobId: job.jobId,
            courseName: job.courseName,
            status: job.status,
            stage: job.currentStage,
            current: job.currentIndex,
            total: job.total,
            percent: job.progressPercent,
            error: job.error,
            courseId: job.courseId ? String(job.courseId) : undefined,
            timestamp: Date.now()
        });
    } catch {
        // socket may not be initialized — progress is best-effort only
    }
};

const emitDone = (instructorId: string, jobId: string, courseName: string, courseId: string) => {
    try {
        emitToUser(instructorId, 'course-creation:done', {
            jobId,
            courseName,
            courseId,
            timestamp: Date.now()
        });
    } catch {
        // best-effort only
    }
};

const emitFailed = (instructorId: string, jobId: string, courseName: string, message: string) => {
    try {
        emitToUser(instructorId, 'course-creation:failed', {
            jobId,
            courseName,
            message,
            timestamp: Date.now()
        });
    } catch {
        // best-effort only
    }
};

const cleanupRemainingFiles = (job: ICourseCreationJob) => {
    for (const v of job.videos || []) {
        if (v.filePath && fs.existsSync(v.filePath)) fs.unlink(v.filePath, () => {});
    }
    for (const a of job.assets || []) {
        if (a.filePath && fs.existsSync(a.filePath)) fs.unlink(a.filePath, () => {});
    }
};

// Recompute currentIndex + progressPercent from the persisted results so the
// value is always derived from durable state (crash-safe).
const recalcProgress = (job: ICourseCreationJob) => {
    const done = (job.resultVideos?.length || 0) + (job.resultAssets?.length || 0);
    job.currentIndex = done;
    job.progressPercent = job.total > 0 ? Math.round((done / job.total) * 100) : 0;
    return job;
};

const saveAndEmit = async (job: ICourseCreationJob) => {
    recalcProgress(job);
    await job.save();
    emitProgress(String(job.instructorId), {
        jobId: String(job._id),
        courseName: job.courseName,
        status: job.status,
        currentStage: job.currentStage,
        currentIndex: job.currentIndex,
        total: job.total,
        progressPercent: job.progressPercent,
        error: job.error,
        courseId: job.courseId,
    });
};

// Flatten per-chapter content back into the legacy top-level arrays so the
// stored course keeps working with existing consumers (previews, dashboards).
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

const buildCourseFromPayload = (job: ICourseCreationJob, instructor: any) => {
    const payload = job.payload as CourseCreationPayload;
    const chapters = JSON.parse(JSON.stringify(payload.chapters || []));

    // Fill uploaded video/asset URLs back into their chapter slots by global index.
    for (const v of job.videos || []) {
        const result = (job.resultVideos || []).find(r => r.g === v.g);
        if (result && chapters[v.ci]?.videos?.[v.vi]) {
            chapters[v.ci].videos[v.vi].videoUrl = result.videoUrl;
        }
    }
    for (const a of job.assets || []) {
        const result = (job.resultAssets || []).find(r => r.g === a.g);
        if (result && chapters[a.ci]?.assets?.[a.ai]) {
            chapters[a.ci].assets[a.ai].url = result.url;
        }
    }

    const flattened = flattenCourseChapters(chapters);

    return {
        courseName: payload.courseName,
        description: payload.description,
        chapters,
        courseVideos: flattened.videos,
        programmingCodes: flattened.programmingCodes,
        assets: flattened.assets,
        quizzes: flattened.quizzes,
        courseRequirements: payload.courseRequirements || [],
        appliedUsers: [],
        price: payload.price,
        duration: payload.duration,
        certificate: payload.certificate,
        instructorDetails: {
            userId: instructor._id,
            name: instructor.name,
            email: instructor.email,
            profilePicture: instructor.profilePicture
        }
    };
};

const completeCourseCreation = async (job: ICourseCreationJob) => {
    const instructor = await Instructor.findById(job.instructorId);
    if (!instructor) {
        return failCourseCreation(String(job._id), "Instructor not found while creating course.");
    }

    job.status = 'creating';
    job.currentStage = 'creating-course';
    await saveAndEmit(job);

    const newCourse = await Course.create(buildCourseFromPayload(job, instructor));

    job.status = 'completed';
    job.currentStage = 'completed';
    job.courseId = newCourse._id;
    job.currentIndex = job.total;
    job.progressPercent = 100;
    await job.save();

    console.log(`[course-creation] ✅ Creation job ${job._id} completed — course "${newCourse.courseName}" created`);

    const instructorId = String(job.instructorId);
    emitProgress(instructorId, {
        jobId: String(job._id),
        courseName: job.courseName,
        status: job.status,
        currentStage: job.currentStage,
        currentIndex: job.currentIndex,
        total: job.total,
        progressPercent: job.progressPercent,
        courseId: newCourse._id,
    });
    emitDone(instructorId, String(job._id), job.courseName, String(newCourse._id));

    // Parity with the synchronous add-course flow: let the dashboard refresh.
    try {
        emitToUser(instructorId, 'course:created', {
            courseId: newCourse._id,
            courseName: newCourse.courseName,
            createdAt: new Date()
        });
    } catch {
        // best-effort only
    }

    const { cacheDelPattern } = await import('../config/redis');
    try {
        await cacheDelPattern(`instructor:${instructorId}:*`);
        await cacheDelPattern('courses:all');
    } catch {
        // cache is optional
    }

    return newCourse;
};

// The core runner. Loads the durable job and enqueues the next unfinished unit
// (video → asset → course-create), so a crashed server resumes at the exact spot.
export const advanceCourseCreation = async (jobId: string): Promise<void> => {
    const job = await CourseCreationJob.findById(jobId);
    if (!job) return;
    if (job.status === 'completed' || job.status === 'failed') return;

    const instructorId = String(job.instructorId);
    const jobKind = job.jobType === 'edit' ? 'edit' : 'creation';

    // Next video with no persisted result yet.
    const nextVideo = (job.videos || []).find(
        (v) => !(job.resultVideos || []).some(r => r.g === v.g)
    );
    if (nextVideo) {
        job.status = 'uploading';
        job.currentStage = 'uploading-videos';
        await saveAndEmit(job);
        console.log(`[course-${jobKind}] 📤 Enqueue YouTube upload for "${nextVideo.originalName}" (g=${nextVideo.g}, job=${jobId})`);

        const { enqueueYouTubeUpload } = await import('../queues');
        await enqueueYouTubeUpload({
            instructorId,
            filePath: nextVideo.filePath,
            originalName: nextVideo.originalName,
            title: nextVideo.title || nextVideo.originalName,
            description: nextVideo.description || "",
            tags: ["course"],
            privacyStatus: "unlisted",
            clientVideoIndex: nextVideo.g,
            courseCreationJobId: jobId,
        });
        return;
    }

    // Next asset with no persisted result yet.
    const nextAsset = (job.assets || []).find(
        (a) => !(job.resultAssets || []).some(r => r.g === a.g)
    );
    if (nextAsset) {
        job.status = 'uploading';
        job.currentStage = 'uploading-assets';
        await saveAndEmit(job);
        console.log(`[course-${jobKind}] 📤 Enqueue Drive upload for "${nextAsset.originalName}" (g=${nextAsset.g}, job=${jobId})`);

        const { enqueueDriveUpload } = await import('../queues');
        await enqueueDriveUpload({
            instructorId,
            filePath: nextAsset.filePath,
            originalName: nextAsset.originalName,
            name: nextAsset.name || nextAsset.originalName,
            mimeType: nextAsset.mimeType,
            clientAssetIndex: nextAsset.g,
            courseCreationJobId: jobId,
        });
        return;
    }

    // All uploads persisted — complete the job (create a new course or update one).
    if (job.jobType === 'edit') {
        await completeCourseEdit(job);
    } else {
        await completeCourseCreation(job);
    }
};

export const runCourseCreation = async (jobId: string): Promise<void> => {
    if (activeRuns.has(jobId)) return;
    activeRuns.add(jobId);
    try {
        await advanceCourseCreation(jobId);
    } catch (error) {
        console.error('Course creation runner error --->', (error as Error)?.message ?? error);
        await failCourseCreation(jobId, (error as Error)?.message ?? "Course creation failed");
    } finally {
        activeRuns.delete(jobId);
    }
};

// Called by the YouTube worker after a successful upload — persists the URL into
// the durable job BEFORE any cleanup so a crash can't lose a finished upload.
export const recordYouTubeResult = async (jobId: string, g: number, videoId: string | null | undefined, videoUrl: string): Promise<void> => {
    const job = await CourseCreationJob.findById(jobId);
    if (!job) return;
    if (job.status === 'completed' || job.status === 'failed') return;

    if (!(job.resultVideos || []).some(r => r.g === g)) {
        job.resultVideos = job.resultVideos || [];
        job.resultVideos.push({ g, videoId: videoId || undefined, videoUrl });
        await job.save();
    }
    await saveAndEmit(job);
    await runCourseCreation(jobId);
};

// Called by the Google Drive worker after a successful upload.
export const recordDriveResult = async (jobId: string, g: number, url: string, fileId?: string): Promise<void> => {
    const job = await CourseCreationJob.findById(jobId);
    if (!job) return;
    if (job.status === 'completed' || job.status === 'failed') return;

    if (!(job.resultAssets || []).some(r => r.g === g)) {
        job.resultAssets = job.resultAssets || [];
        job.resultAssets.push({ g, url, fileId: fileId || undefined });
        await job.save();
    }
    await saveAndEmit(job);
    await runCourseCreation(jobId);
};

// Live sub-progress of the currently in-flight upload, blended into the linear
// overall percent so the dashboard bar moves smoothly during a single upload.
export const trackCourseCreationUploadProgress = async (jobId: string, percent: number): Promise<void> => {
    const job = await CourseCreationJob.findById(jobId);
    if (!job) return;
    if (job.status === 'completed' || job.status === 'failed') return;

    const done = (job.resultVideos?.length || 0) + (job.resultAssets?.length || 0);
    const safePercent = Math.max(0, Math.min(100, Number.isFinite(percent) ? percent : 0));
    job.currentIndex = done;
    job.progressPercent = job.total > 0
        ? Math.round(((done + safePercent / 100) / job.total) * 100)
        : 0;
    await job.save();
    emitProgress(String(job.instructorId), {
        jobId: String(job._id),
        courseName: job.courseName,
        status: job.status,
        currentStage: job.currentStage,
        currentIndex: done,
        total: job.total,
        progressPercent: job.progressPercent,
        error: job.error,
        courseId: job.courseId,
    });
};

export const failCourseCreation = async (jobId: string, message: string): Promise<void> => {
    const job = await CourseCreationJob.findById(jobId);
    if (!job) return;
    if (job.status === 'completed' || job.status === 'failed') return;

    job.status = 'failed';
    job.currentStage = 'failed';
    job.error = message;
    job.progressPercent = job.progressPercent || 0;
    await job.save();

    cleanupRemainingFiles(job);

    emitFailed(String(job.instructorId), jobId, job.courseName, message);
};

export const createCourseCreationJob = async (
    instructorId: string,
    payload: CourseCreationPayload,
    videos: CourseCreationVideoFile[],
    assets: CourseCreationAssetFile[]
): Promise<{ jobId: string; job: ICourseCreationJob }> => {
    const total = videos.length + assets.length + 1;

    const job = await CourseCreationJob.create({
        instructorId: new mongoose.Types.ObjectId(instructorId),
        courseName: payload.courseName,
        jobType: 'create',
        status: 'pending',
        currentStage: 'uploading-videos',
        currentIndex: 0,
        total,
        progressPercent: 0,
        videos,
        assets,
        resultVideos: [],
        resultAssets: [],
        payload,
    });

    console.log(`[course-creation] 🚀 New course CREATION job ${job._id} started for "${payload.courseName}" (${videos.length} video(s), ${assets.length} asset(s))`);

    emitProgress(instructorId, {
        jobId: String(job._id),
        courseName: job.courseName,
        status: job.status,
        currentStage: job.currentStage,
        currentIndex: 0,
        total,
        progressPercent: 0,
    });

    await runCourseCreation(String(job._id));

    return { jobId: String(job._id), job };
};

// Creates a durable edit job for an existing course. Mirrors the create flow:
// new video/asset files are uploaded sequentially in the background (worker /
// in-process executor) and the course is updated only after every upload lands.
export const createCourseEditJob = async (
    instructorId: string,
    courseId: string,
    payload: CourseCreationPayload,
    videos: CourseCreationVideoFile[],
    assets: CourseCreationAssetFile[]
): Promise<{ jobId: string; job: ICourseCreationJob }> => {
    const total = videos.length + assets.length + 1;

    const job = await CourseCreationJob.create({
        instructorId: new mongoose.Types.ObjectId(instructorId),
        courseName: payload.courseName,
        jobType: 'edit',
        status: 'pending',
        currentStage: 'uploading-videos',
        currentIndex: 0,
        total,
        progressPercent: 0,
        videos,
        assets,
        resultVideos: [],
        resultAssets: [],
        payload,
        courseId: new mongoose.Types.ObjectId(courseId),
    });

    console.log(`[course-edit] 🚀 New course EDIT job ${job._id} started for "${payload.courseName}" (${videos.length} new video(s), ${assets.length} new asset(s))`);

    emitProgress(instructorId, {
        jobId: String(job._id),
        courseName: job.courseName,
        status: job.status,
        currentStage: job.currentStage,
        currentIndex: 0,
        total,
        progressPercent: 0,
    });

    await runCourseCreation(String(job._id));

    return { jobId: String(job._id), job };
};

// Best-effort deletion of content removed from the course during an edit job.
// Mirrors the synchronous edit flow (delete-only) so removed videos/assets don't
// stay orphaned on YouTube/Google Drive. Failures are logged, never fatal.
const deleteRemovedCourseContent = async (course: any, finalChapters: any[], instructor: any): Promise<string[]> => {
    const deletionErrors: string[] = [];
    const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_DRIVE_REDIRECT_URI;

    // YouTube video deletions
    const oldVideoUrls = course.courseVideos?.map((v: any) => v.videoUrl) || [];
    const newVideoUrls = (finalChapters || []).flatMap((ch: any) => ch?.videos || []).map((v: any) => v.videoUrl);
    const deletedVideos = oldVideoUrls.filter((url: string) => !newVideoUrls.includes(url));

    if (deletedVideos.length > 0) {
        if (instructor.youtubeTokens && clientId && clientSecret && redirectUri) {
            try {
                const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
                oauth2Client.setCredentials({
                    access_token: instructor.youtubeTokens.accessToken,
                    refresh_token: instructor.youtubeTokens.refreshToken
                });

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
                        deletionErrors.push(`YouTube token refresh failed: ${refreshError.message}. Please re-authenticate with YouTube.`);
                    }
                }

                const youtube = google.youtube({ version: "v3", auth: oauth2Client });
                for (const videoUrl of deletedVideos) {
                    try {
                        const match = videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/);
                        if (match) {
                            await youtube.videos.delete({ id: match[1] });
                            console.log(`[course-edit] ✅ Deleted YouTube video: ${match[1]}`);
                        }
                    } catch (error: any) {
                        deletionErrors.push(`Failed to delete YouTube video ${videoUrl}: ${error.message || error}. The video remains on YouTube.`);
                    }
                }
            } catch (authError: any) {
                deletionErrors.push(`YouTube authentication error: ${authError.message}. Please re-authenticate with YouTube to delete videos.`);
            }
        } else {
            deletionErrors.push("YouTube OAuth credentials/tokens unavailable. Videos cannot be deleted from YouTube.");
        }
    }

    // Google Drive asset deletions
    const oldAssetUrls = course.assets?.map((a: any) => a.url) || [];
    const newAssetUrls = (finalChapters || []).flatMap((ch: any) => ch?.assets || []).map((a: any) => a.url);
    const deletedAssets = oldAssetUrls.filter((url: string) => !newAssetUrls.includes(url));

    if (deletedAssets.length > 0) {
        if (instructor.driveTokens && clientId && clientSecret && redirectUri) {
            try {
                const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
                oauth2Client.setCredentials({
                    access_token: instructor.driveTokens.accessToken,
                    refresh_token: instructor.driveTokens.refreshToken
                });

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
                        deletionErrors.push(`Drive token refresh failed: ${refreshError.message}. Please re-authenticate with Google Drive.`);
                    }
                }

                const drive = google.drive({ version: "v3", auth: oauth2Client });
                for (const assetUrl of deletedAssets) {
                    try {
                        const match = assetUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
                        if (match) {
                            await drive.files.delete({ fileId: match[1] });
                            console.log(`[course-edit] ✅ Deleted Drive asset: ${match[1]}`);
                        }
                    } catch (error: any) {
                        deletionErrors.push(`Failed to delete Drive asset ${assetUrl}: ${error.message || error}. The asset remains on Google Drive.`);
                    }
                }
            } catch (authError: any) {
                deletionErrors.push(`Drive authentication error: ${authError.message}. Please re-authenticate with Google Drive to delete assets.`);
            }
        } else {
            deletionErrors.push("Google Drive OAuth credentials/tokens unavailable. Assets cannot be deleted from Drive.");
        }
    }

    return deletionErrors;
};

// After every upload in an edit job is persisted, update the existing course
// with the new URLs and apply the (already client-resolved) payload fields.
const completeCourseEdit = async (job: ICourseCreationJob): Promise<void> => {
    const instructor = await Instructor.findById(job.instructorId);
    if (!instructor) {
        return failCourseCreation(String(job._id), "Instructor not found while updating course.");
    }

    const course = job.courseId ? await Course.findById(job.courseId) : null;
    if (!course) {
        return failCourseCreation(String(job._id), "Course not found while updating.");
    }

    job.status = 'creating';
    job.currentStage = 'creating-course';
    await saveAndEmit(job);

    const payload = job.payload as CourseCreationPayload;
    const chapters = JSON.parse(JSON.stringify(payload.chapters || []));

    // Fill uploaded video/asset URLs back into their chapter slots by global index.
    for (const v of job.videos || []) {
        const result = (job.resultVideos || []).find(r => r.g === v.g);
        if (result && chapters[v.ci]?.videos?.[v.vi]) {
            chapters[v.ci].videos[v.vi].videoUrl = result.videoUrl;
        }
    }
    for (const a of job.assets || []) {
        const result = (job.resultAssets || []).find(r => r.g === a.g);
        if (result && chapters[a.ci]?.assets?.[a.ai]) {
            chapters[a.ci].assets[a.ai].url = result.url;
        }
    }

    const flattened = flattenCourseChapters(chapters);

    // Delete any content the instructor removed from the course (best-effort).
    const deletionErrors = await deleteRemovedCourseContent(course, chapters, instructor);

    // Apply the resolved fields to the existing course document.
    if (payload.courseName) course.courseName = payload.courseName;
    if (payload.description !== undefined) course.description = payload.description;
    if (payload.price !== undefined) course.price = payload.price;
    if (payload.duration !== undefined) course.duration = payload.duration;
    if (payload.certificate !== undefined) course.certificate = payload.certificate;
    if (payload.courseRequirements !== undefined) course.courseRequirements = payload.courseRequirements;
    course.chapters = chapters;
    course.courseVideos = flattened.videos;
    course.programmingCodes = flattened.programmingCodes;
    course.assets = flattened.assets;
    course.quizzes = flattened.quizzes;

    await course.save();

    job.status = 'completed';
    job.currentStage = 'completed';
    job.currentIndex = job.total;
    job.progressPercent = 100;
    await job.save();

    console.log(`[course-edit] ✅ Edit job ${job._id} completed — course "${course.courseName}" updated` + (deletionErrors.length > 0 ? ` (${deletionErrors.length} deletion issue(s))` : ''));

    const instructorId = String(job.instructorId);
    emitProgress(instructorId, {
        jobId: String(job._id),
        courseName: job.courseName,
        status: job.status,
        currentStage: job.currentStage,
        currentIndex: job.currentIndex,
        total: job.total,
        progressPercent: job.progressPercent,
        courseId: course._id,
    });
    emitDone(instructorId, String(job._id), job.courseName, String(course._id));

    try {
        emitToUser(instructorId, 'course:updated', {
            courseId: course._id,
            courseName: course.courseName,
            updatedAt: new Date()
        });
    } catch {
        // best-effort only
    }

    const { cacheDelPattern } = await import('../config/redis');
    try {
        await cacheDelPattern(`instructor:${instructorId}:*`);
        await cacheDelPattern('courses:all');
        await cacheDelPattern(`course:${course._id}`);
    } catch {
        // cache is optional
    }
};

export const getActiveCourseCreations = async (instructorId: string): Promise<ActiveCourseCreationJob[]> => {
    const jobs = await CourseCreationJob.find({
        instructorId: new mongoose.Types.ObjectId(instructorId),
        status: { $in: ['pending', 'uploading', 'creating'] },
    }).sort({ createdAt: -1 }).limit(5).lean();

    return jobs.map((job) => ({
        jobId: String(job._id),
        jobType: (job.jobType || 'create') as 'create' | 'edit',
        courseName: job.courseName,
        status: job.status,
        stage: job.currentStage,
        current: job.currentIndex,
        total: job.total,
        percent: job.progressPercent,
        error: job.error,
        courseId: job.courseId ? String(job.courseId) : undefined,
    }));
};

// On boot, re-drive any job that was interrupted by a server restart. Workers
// re-enqueue the exact unfinished uploads; finished URLs are already persisted.
export const resumeInterruptedCourseCreations = async (): Promise<void> => {
    const jobs = await CourseCreationJob.find({
        status: { $in: ['pending', 'uploading', 'creating'] },
    }).sort({ updatedAt: 1 });

    if (jobs.length === 0) return;
    console.log(`🔁 Resuming ${jobs.length} interrupted course creation job(s)`);

    for (const job of jobs) {
        runCourseCreation(String(job._id)).catch((error) => {
            console.error(`Failed to resume course creation ${job._id}:`, error);
        });
    }
};
