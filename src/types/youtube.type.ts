export interface YouTubeUploadReqBody {
    title?: string;
    description?: string;
    tags?: string | string[]; // multipart sends tags as comma-separated string or repeated fields
    privacyStatus?: "public" | "private" | "unlisted";
}

export interface YouTubeUploadResT {
    status: "success" | "failed";
    message: string;
    videoId?: string | null;
    videoUrl?: string;
}


