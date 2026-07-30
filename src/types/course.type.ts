import mongoose from 'mongoose';

export interface ICourse extends mongoose.Document {
    courseName: string;
    description: string;
    courseVideos: {
        videoUrl: string;
        videoTitle: string;
        videoDescription: string;
        videoDuration: number;
        isProgrammingVideo: boolean;
        isPreview: boolean;
    }[];
    programmingCodes: {
        code: string;
        language: string;
        explanation: string;
        fileName: string;
    }[];
    assets: {
        name: string;
        url: string;
    }[];
    quizzes: {
        title: string;
        questions: {
            question: string;
            options: {
                option: string;
                isCorrect: boolean;
            }[];
            correctAnswer: string;
        }[];
    }[];
    courseRequirements: string[];
    appliedUsers: {
        userId: mongoose.Types.ObjectId;
        userName: string;
        userEmail: string;
        ipAddress: string;
        appliedAt: Date;
    }[];
    ratings: {
        userId: mongoose.Types.ObjectId;
        userName: string;
        rating: number;
        comment: string;
        ratedAt: Date;
    }[];
    averageRating: number;
    price: number;
    duration: number;
    certificate: string;
    instructorDetails: {
        userId: mongoose.Types.ObjectId;
        name: string;
        email: string;
        profilePicture: string;
    };
}

// Course Controller Types

export type AddCourseReqBody = {
    courseName: string;
    description: string;
    courseVideos: Array<{
        videoUrl: string;
        videoTitle: string;
        videoDescription: string;
        videoDuration: number;
        isProgrammingVideo: boolean;
        isPreview: boolean;
    }>;
    programmingCodes: Array<{
        code: string;
        language: string;
        explanation: string;
        fileName: string;
    }>;
    assets: Array<{
        name: string;
        url: string;
    }>;
    quizzes: Array<{
        title: string;
        questions: Array<{
            question: string;
            options: Array<{
                option: string;
                isCorrect: boolean;
            }>;
            correctAnswer: string;
        }>;
    }>;
    courseRequirements: string[];
    price: number;
    duration: number;
    certificate: string;
}

export type AddCourseResT = {
    status: "success" | "failed";
    message: string;
    course?: ICourse;
}

export type FetchCoursesByUserReqBody = {
    userId: string;
}

export type FetchCoursesByUserResT = {
    status: "success" | "failed";
    message: string;
    courses?: ICourse[];
}

export type FetchAllCoursesResT = {
    status: "success" | "failed";
    message: string;
    courses?: Partial<ICourse>[];
}

export type EditCourseReqBody = {
    courseName?: string;
    description?: string;
    courseVideos?: Array<{
        videoUrl: string;
        videoTitle: string;
        videoDescription: string;
        videoDuration: number;
        isProgrammingVideo: boolean;
        isPreview: boolean;
    }>;
    programmingCodes?: Array<{
        code: string;
        language: string;
        explanation: string;
        fileName: string;
    }>;
    assets?: Array<{
        name: string;
        url: string;
    }>;
    quizzes?: Array<{
        title: string;
        questions: Array<{
            question: string;
            options: Array<{
                option: string;
                isCorrect: boolean;
            }>;
            correctAnswer: string;
        }>;
    }>;
    courseRequirements?: string[];
    price?: number;
    duration?: number;
    certificate?: string;
}

export type EditCourseResT = {
    status: "success" | "failed";
    message: string;
    course?: ICourse;
    deletionErrors?: string[];
}

export type FetchCourseByIdResT = {
    status: "success" | "failed";
    message: string;
    course?: ICourse;
}