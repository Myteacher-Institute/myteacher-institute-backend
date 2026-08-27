export interface YouTubeUploadJob {
    instructorId: string;
    filePath: string;
    originalName: string;
    title: string;
    description: string;
    tags: string[];
    privacyStatus: 'public' | 'private' | 'unlisted';
    clientVideoIndex?: number;
    courseCreationJobId?: string;
}

export interface DriveUploadJob {
    instructorId: string;
    filePath: string;
    originalName: string;
    name: string;
    mimeType: string;
    clientAssetIndex?: number;
    courseCreationJobId?: string;
}
