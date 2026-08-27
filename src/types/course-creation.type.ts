import mongoose from 'mongoose';

export type CourseCreationStatus = 'pending' | 'uploading' | 'creating' | 'completed' | 'failed';

export type CourseCreationStage =
    | 'youtube-auth'
    | 'uploading-videos'
    | 'uploading-assets'
    | 'creating-course'
    | 'completed'
    | 'failed';

export interface CourseCreationVideoFile {
    ci: number;
    vi: number;
    g: number;
    filePath: string;
    originalName: string;
    title: string;
    description: string;
    videoTitle: string;
    videoDescription: string;
    videoDuration: number;
    isProgrammingVideo: boolean;
    isPreview: boolean;
}

export interface CourseCreationAssetFile {
    ci: number;
    ai: number;
    g: number;
    filePath: string;
    originalName: string;
    name: string;
    mimeType: string;
}

export interface CourseCreationResultVideo {
    g: number;
    videoId?: string;
    videoUrl: string;
}

export interface CourseCreationResultAsset {
    g: number;
    fileId?: string;
    url: string;
}

export interface CourseCreationPayload {
    courseName: string;
    description: string;
    chapters: any[];
    courseVideos: any[];
    programmingCodes: any[];
    assets: any[];
    quizzes: any[];
    courseRequirements: string[];
    price: number;
    duration: number;
    certificate: string;
}

export interface ICourseCreationJob extends mongoose.Document {
    jobType: 'create' | 'edit';
    instructorId: mongoose.Types.ObjectId;
    courseName: string;
    status: CourseCreationStatus;
    currentStage: CourseCreationStage;
    currentIndex: number;
    total: number;
    progressPercent: number;
    videos: CourseCreationVideoFile[];
    assets: CourseCreationAssetFile[];
    resultVideos: CourseCreationResultVideo[];
    resultAssets: CourseCreationResultAsset[];
    payload: CourseCreationPayload;
    error?: string;
    courseId?: mongoose.Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

export type CreateCourseCreationReqBody = {
    metadata?: string;
};

export type CreateCourseCreationResT = {
    status: 'success' | 'failed';
    message: string;
    jobId?: string;
};

export type ActiveCourseCreationJob = {
    jobId: string;
    jobType?: 'create' | 'edit';
    courseName: string;
    status: CourseCreationStatus;
    stage: CourseCreationStage;
    current: number;
    total: number;
    percent: number;
    error?: string;
    courseId?: string;
};

export type FetchActiveCourseCreationsResT = {
    status: 'success' | 'failed';
    message: string;
    jobs?: ActiveCourseCreationJob[];
};
