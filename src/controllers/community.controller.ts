import { Request, Response } from "express";
import { Community } from "../models/community.model";
import { Instructor } from "../models/instructor.model";
import { Course } from "../models/course.model";
import User from "../models/user.model";
import { CreateCommunityReqBody, CreateCommunityResT, GetAllCommunitiesResT, GetCommunityByIdResT, JoinCommunityResT, PostContentReqBody, PostContentResT, LikePostResT, CommentPostReqBody, CommentPostResT } from "../types";

// Create a new community (instructor only)
export const handleCreateCommunity = async (req: Request<{}, {}, CreateCommunityReqBody>, res: Response<CreateCommunityResT>) => {
    try {
        const instructorId = req.userId;

        if (!instructorId) {
            return res.status(401).json({
                status: "failed",
                message: "Unauthorized"
            });
        }

        const instructor = await Instructor.findById(instructorId);

        if (!instructor) {
            return res.status(404).json({
                status: "failed",
                message: "Instructor not found"
            });
        }

        const { name, description, profilePicture, coverImage } = req.body;

        if (!name || !description) {
            return res.status(400).json({
                status: "failed",
                message: "Name and description are required"
            });
        }

        // Get instructor's courses
        const instructorCourses = await Course.find({ 'instructorDetails.userId': instructorId });

        const coursesToLink = instructorCourses.map(course => ({
            courseId: course._id,
            courseName: course.courseName,
            category: course.category,
            price: course.price
        }));

        const newCommunity = await Community.create({
            name,
            description,
            creator: instructorId,
            creatorName: instructor.name,
            creatorEmail: instructor.email,
            profilePicture: profilePicture || instructor.profilePicture,
            coverImage,
            courses: coursesToLink,
            followerCount: 0
        });

        res.status(201).json({
            status: "success",
            message: "Community created successfully",
            data: newCommunity as any
        });
    } catch (error) {
        console.error("Error creating community:", error);
        res.status(500).json({
            status: "failed",
            message: "Internal server error"
        });
    }
};

// Get all communities
export const handleGetAllCommunities = async (req: Request, res: Response<GetAllCommunitiesResT>) => {
    try {
        const communities = await Community.find()
            .populate('creator', 'name email profilePicture')
            .sort({ createdAt: -1 });

        res.status(200).json({
            status: "success",
            message: "Communities fetched successfully",
            data: communities as any
        });
    } catch (error) {
        console.error("Error fetching communities:", error);
        res.status(500).json({
            status: "failed",
            message: "Internal server error"
        });
    }
};

// Get community by ID
export const handleGetCommunityById = async (req: Request, res: Response<GetCommunityByIdResT>) => {
    try {
        const { communityId } = req.params;

        const community = await Community.findById(communityId)
            .populate('creator', 'name email profilePicture')
            .populate('members.userId', 'name email profilePicture')
            .populate('courses.courseId', 'courseName category price')
            .populate('posts.likes.userId', 'name profilePicture')
            .populate('posts.comments.userId', 'name profilePicture');

        if (!community) {
            return res.status(404).json({
                status: "failed",
                message: "Community not found"
            });
        }

        res.status(200).json({
            status: "success",
            message: "Community fetched successfully",
            data: community as any
        });
    } catch (error) {
        console.error("Error fetching community:", error);
        res.status(500).json({
            status: "failed",
            message: "Internal server error"
        });
    }
};

// Join community
export const handleJoinCommunity = async (req: Request, res: Response<JoinCommunityResT>) => {
    try {
        const userId = req.userId;
        const { communityId } = req.params;

        if (!userId) {
            return res.status(401).json({
                status: "failed",
                message: "Unauthorized"
            });
        }

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                status: "failed",
                message: "User not found"
            });
        }

        const community = await Community.findById(communityId);

        if (!community) {
            return res.status(404).json({
                status: "failed",
                message: "Community not found"
            });
        }

        // Check if user is already a member
        const isMember = community.members.some(member => member.userId && member.userId.toString() === userId);

        if (isMember) {
            return res.status(400).json({
                status: "failed",
                message: "User is already a member of this community"
            });
        }

        // Add user to community
        community.members.push({
            userId: user._id,
            userName: user.name,
            joinedAt: new Date()
        });

        community.followerCount = community.members.length;
        await community.save();

        res.status(200).json({
            status: "success",
            message: "Successfully joined community",
            data: community as any
        });
    } catch (error) {
        console.error("Error joining community:", error);
        res.status(500).json({
            status: "failed",
            message: "Internal server error"
        });
    }
};

// Leave community
export const handleLeaveCommunity = async (req: Request, res: Response<JoinCommunityResT>) => {
    try {
        const userId = req.userId;
        const { communityId } = req.params;

        if (!userId) {
            return res.status(401).json({
                status: "failed",
                message: "Unauthorized"
            });
        }

        const community = await Community.findById(communityId);

        if (!community) {
            return res.status(404).json({
                status: "failed",
                message: "Community not found"
            });
        }

        // Remove user from community
        const filteredMembers = community.members.filter((member: any) => !member.userId || member.userId.toString() !== userId);
        community.members = filteredMembers as any;
        community.followerCount = filteredMembers.length;
        await community.save();

        res.status(200).json({
            status: "success",
            message: "Successfully left community",
            data: community as any
        });
    } catch (error) {
        console.error("Error leaving community:", error);
        res.status(500).json({
            status: "failed",
            message: "Internal server error"
        });
    }
};

// Post content to community
export const handlePostContent = async (req: Request<{ communityId: string }, {}, PostContentReqBody>, res: Response<PostContentResT>) => {
    try {
        const userId = req.userId;
        const { communityId } = req.params;
        const { content, mediaType, mediaUrl } = req.body;

        if (!userId) {
            return res.status(401).json({
                status: "failed",
                message: "Unauthorized"
            });
        }

        if (!content) {
            return res.status(400).json({
                status: "failed",
                message: "Content is required"
            });
        }

        const community = await Community.findById(communityId);

        if (!community) {
            return res.status(404).json({
                status: "failed",
                message: "Community not found"
            });
        }

        // Check if user is a member or the creator
        const isMember = community.members.some(member => member.userId && member.userId.toString() === userId);
        const isCreator = community.creator.toString() === userId;

        if (!isMember && !isCreator) {
            return res.status(403).json({
                status: "failed",
                message: "You must be a member to post"
            });
        }

        const user = await User.findById(userId) || await Instructor.findById(userId);

        if (!user) {
            return res.status(404).json({
                status: "failed",
                message: "User not found"
            });
        }

        // Add post to community
        community.posts.push({
            content,
            mediaType: mediaType || 'text',
            mediaUrl,
            likes: [],
            comments: [],
            createdAt: new Date()
        });

        await community.save();

        res.status(201).json({
            status: "success",
            message: "Post created successfully",
            data: community as any
        });
    } catch (error) {
        console.error("Error creating post:", error);
        res.status(500).json({
            status: "failed",
            message: "Internal server error"
        });
    }
};

// Like post
export const handleLikePost = async (req: Request<{ communityId: string; postId: string }>, res: Response<LikePostResT>) => {
    try {
        const userId = req.userId;
        const { communityId, postId } = req.params;

        if (!userId) {
            return res.status(401).json({
                status: "failed",
                message: "Unauthorized"
            });
        }

        const community = await Community.findById(communityId);

        if (!community) {
            return res.status(404).json({
                status: "failed",
                message: "Community not found"
            });
        }

        const post = community.posts.id(Array.isArray(postId) ? postId[0] : postId);

        if (!post) {
            return res.status(404).json({
                status: "failed",
                message: "Post not found"
            });
        }

        // Check if user already liked the post
        const alreadyLiked = post.likes.some(like => like.userId && like.userId.toString() === userId);

        if (alreadyLiked) {
            // Remove like
            post.likes = post.likes.filter((like: any) => !like.userId || like.userId.toString() !== userId) as any;
        } else {
            // Add like
            post.likes.push({
                userId: userId as any,
                likedAt: new Date()
            } as any);
        }

        await community.save();

        res.status(200).json({
            status: "success",
            message: alreadyLiked ? "Like removed" : "Post liked",
            data: post as any
        });
    } catch (error) {
        console.error("Error liking post:", error);
        res.status(500).json({
            status: "failed",
            message: "Internal server error"
        });
    }
};

// Comment on post
export const handleCommentPost = async (req: Request<{ communityId: string; postId: string }, {}, CommentPostReqBody>, res: Response<CommentPostResT>) => {
    try {
        const userId = req.userId;
        const { communityId, postId } = req.params;
        const { comment } = req.body;

        if (!userId) {
            return res.status(401).json({
                status: "failed",
                message: "Unauthorized"
            });
        }

        if (!comment) {
            return res.status(400).json({
                status: "failed",
                message: "Comment is required"
            });
        }

        const community = await Community.findById(communityId);

        if (!community) {
            return res.status(404).json({
                status: "failed",
                message: "Community not found"
            });
        }

        const post = community.posts.id(Array.isArray(postId) ? postId[0] : postId);

        if (!post) {
            return res.status(404).json({
                status: "failed",
                message: "Post not found"
            });
        }

        const user = await User.findById(userId) || await Instructor.findById(userId);

        if (!user) {
            return res.status(404).json({
                status: "failed",
                message: "User not found"
            });
        }

        // Add comment
        post.comments.push({
            userId: userId as any,
            userName: user.name,
            comment,
            commentedAt: new Date()
        });

        await community.save();

        res.status(201).json({
            status: "success",
            message: "Comment added successfully",
            data: post as any
        });
    } catch (error) {
        console.error("Error commenting on post:", error);
        res.status(500).json({
            status: "failed",
            message: "Internal server error"
        });
    }
};
