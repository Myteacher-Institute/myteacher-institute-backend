import mongoose from "mongoose";

export interface ICommunityPost {
    content: string;
    mediaType: 'text' | 'image' | 'video';
    mediaUrl?: string | null;
    likes: Array<{
        userId?: mongoose.Types.ObjectId | null;
        likedAt: Date;
    }>;
    comments: Array<{
        userId: mongoose.Types.ObjectId;
        userName: string;
        comment: string;
        commentedAt: Date;
    }>;
    createdAt: Date;
}

export interface ICommunity extends mongoose.Document {
    name: string;
    description: string;
    creator: mongoose.Types.ObjectId;
    creatorName: string;
    creatorEmail: string;
    profilePicture?: string | null;
    coverImage?: string | null;
    members: Array<{
        userId?: mongoose.Types.ObjectId | null;
        userName?: string | null;
        joinedAt: Date;
    }>;
    posts: ICommunityPost[];
    courses: Array<{
        courseId: mongoose.Types.ObjectId;
        courseName: string;
        category: string;
        price: number;
    }>;
    followerCount: number;
    createdAt: Date;
}

export interface CreateCommunityReqBody {
    name: string;
    description: string;
    profilePicture?: string;
    coverImage?: string;
}

export interface CreateCommunityResT {
    status: string;
    message: string;
    data?: ICommunity;
}

export interface GetAllCommunitiesResT {
    status: string;
    message?: string;
    data?: ICommunity[];
}

export interface GetCommunityByIdResT {
    status: string;
    message?: string;
    data?: ICommunity;
}

export interface JoinCommunityResT {
    status: string;
    message: string;
    data?: ICommunity;
}

export interface PostContentReqBody {
    content: string;
    mediaType?: 'text' | 'image' | 'video';
    mediaUrl?: string;
}

export interface PostContentResT {
    status: string;
    message: string;
    data?: ICommunity;
}

export interface LikePostResT {
    status: string;
    message: string;
    data?: ICommunityPost;
}

export interface CommentPostReqBody {
    comment: string;
}

export interface CommentPostResT {
    status: string;
    message: string;
    data?: ICommunityPost;
}
