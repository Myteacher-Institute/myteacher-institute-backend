import { YouTubeUploadReqBody } from "../types/youtube.type";

export const youtubeUploadValidation = (body: YouTubeUploadReqBody, instructorId?: string) => {
    if (!instructorId) {
        return {
            isValid: false,
            message: "Unauthorized: Instructor ID not found"
        };
    }

    if (!body.videoPath) {
        return {
            isValid: false,
            message: "Video path is required"
        };
    }

    if (body.privacyStatus && !["public", "private", "unlisted"].includes(body.privacyStatus)) {
        return {
            isValid: false,
            message: "Invalid privacy status. Must be 'public', 'private', or 'unlisted'"
        };
    }

    return {
        isValid: true,
        message: "Validation passed"
    };
};
