export interface YouTubeUploadReqBody {
    title?: string;
    description?: string;
    tags?: string | string[]; // multipart sends tags as comma-separated string or repeated fields
    privacyStatus?: "public" | "private" | "unlisted";
    clientVideoIndex?: number | string; // echoed back in socket progress events so the frontend can match the video
}

export interface YouTubeUploadResT {
    status: "success" | "failed" | "reauth_required";
    message: string;
    videoId?: string | null;
    videoUrl?: string;
    authUrl?: string;
    requiresReauth?: boolean;
}


