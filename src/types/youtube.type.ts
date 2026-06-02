export interface YouTubeUploadReqBody {
    videoPath: string;
    title?: string;
    description?: string;
    tags?: string[];
    privacyStatus?: "public" | "private" | "unlisted";
}

export interface YouTubeUploadResT {
    status: "success" | "failed";
    message: string;
    videoId?: string | null;
    videoUrl?: string;
}
