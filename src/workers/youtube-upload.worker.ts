import fs from "fs";
import path from "path";
import { Transform } from "stream";
import { google } from "googleapis";
import { Instructor } from "../models/instructor.model";
import { SCOPES, createOAuth2Client } from "../services/google-youtube.services";
import { emitToUser } from "../config/socket";
import type { YouTubeUploadJob } from "../queues/types";
import { signState } from "../utils/oauth-state";

const ALLOWED_VIDEO_DIR = path.resolve(
    process.env.VIDEO_UPLOAD_DIR || path.join(process.cwd(), 'uploads', 'videos')
);

const emitProgress = (instructorId: string, videoIndex: number | undefined, stage: string, percent?: number) => {
    try {
        emitToUser(instructorId, 'youtube-upload:progress', {
            videoIndex: typeof videoIndex === 'number' ? videoIndex : undefined,
            stage,
            percent: typeof percent === 'number' ? Math.max(0, Math.min(100, Math.round(percent))) : undefined,
            timestamp: Date.now()
        });
    } catch {
        // socket may not be initialized — progress is best-effort only
    }
};

const emitDone = (instructorId: string, videoIndex: number | undefined, videoId: string | null | undefined) => {
    try {
        emitToUser(instructorId, 'youtube-upload:done', {
            videoIndex: typeof videoIndex === 'number' ? videoIndex : undefined,
            videoId,
            videoUrl: videoId ? `https://www.youtube.com/watch?v=${videoId}` : undefined,
            timestamp: Date.now()
        });
    } catch {
        // best-effort only
    }
};

const emitFailed = (instructorId: string, videoIndex: number | undefined, status: 'failed' | 'reauth_required', message: string, authUrl?: string) => {
    try {
        emitToUser(instructorId, 'youtube-upload:failed', {
            videoIndex: typeof videoIndex === 'number' ? videoIndex : undefined,
            status,
            message,
            authUrl,
            requiresReauth: status === 'reauth_required',
            timestamp: Date.now()
        });
    } catch {
        // best-effort only
    }
};

const emitReauth = (instructorId: string, videoIndex: number | undefined) => {
    const oAuth2Client = createOAuth2Client(google);
    // Sign the state with the shared HMAC secret so the callback verifies it
    const state = signState({ instructorId });
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: "offline",
        prompt: "consent",
        scope: SCOPES,
        state,
    });
    emitFailed(
        instructorId,
        videoIndex,
        'reauth_required',
        "YouTube re-authentication required. Your session has expired. Please connect YouTube again.",
        authUrl
    );
};

const refreshAccessToken = async (oAuth2Client: any, instructor: any) => {
    const { credentials } = await oAuth2Client.refreshAccessToken();
    oAuth2Client.setCredentials(credentials);
    await Instructor.findByIdAndUpdate(instructor._id, {
        youtubeTokens: {
            accessToken: credentials.access_token,
            refreshToken: credentials.refresh_token || instructor.youtubeTokens.refreshToken,
            expiryDate: credentials.expiry_date
        }
    });
    return credentials;
};

export const processYouTubeUpload = async (job: YouTubeUploadJob): Promise<void> => {
    const { instructorId, filePath, originalName, title, description, tags, privacyStatus, clientVideoIndex } = job;

    const cleanup = () => {
        if (filePath && fs.existsSync(filePath)) {
            fs.unlink(filePath, () => {});
        }
    };

    try {
        // #12 Verify the file path is inside the allowed upload directory
        const resolvedPath = path.resolve(filePath);
        if (!resolvedPath.startsWith(ALLOWED_VIDEO_DIR + path.sep)) {
            throw new Error('Invalid file path');
        }

        if (!fs.existsSync(resolvedPath)) {
            throw new Error('Video file not found. Please upload the file again.');
        }

        const instructor = await Instructor.findById(instructorId);
        if (!instructor || !instructor.youtubeTokens) {
            cleanup();
            emitReauth(instructorId, clientVideoIndex);
            return;
        }

        // Guard: a refresh token is required to recover from an expired access token
        if (!instructor.youtubeTokens.refreshToken) {
            cleanup();
            emitReauth(instructorId, clientVideoIndex);
            return;
        }

        const oAuth2Client = createOAuth2Client(google);
        oAuth2Client.setCredentials({
            access_token: instructor.youtubeTokens.accessToken,
            refresh_token: instructor.youtubeTokens.refreshToken,
            expiry_date: instructor.youtubeTokens.expiryDate
        });

        // Refresh if: expiry is missing/zero OR token has expired
        const needsRefresh = !instructor.youtubeTokens.expiryDate || instructor.youtubeTokens.expiryDate < Date.now();
        if (needsRefresh) {
            try {
                await refreshAccessToken(oAuth2Client, instructor);
            } catch {
                cleanup();
                emitReauth(instructorId, clientVideoIndex);
                return;
            }
        }

        const youtube = google.youtube({ version: "v3", auth: oAuth2Client });

        emitProgress(instructorId, clientVideoIndex, 'preparing', 0);

        // Track how many bytes have actually reached YouTube so we can show a
        // real progress percentage during the long server-side upload (~1-4 minutes).
        const totalBytes = fs.statSync(resolvedPath).size;
        let uploadedBytes = 0;
        let lastEmittedPercent = -1;
        const progressStream = new Transform({
            transform(chunk: Buffer, _encoding, callback) {
                uploadedBytes += chunk.length;
                const pct = Math.min(99, Math.max(1, Math.round((uploadedBytes / totalBytes) * 100)));
                if (pct !== lastEmittedPercent) {
                    lastEmittedPercent = pct;
                    emitProgress(instructorId, clientVideoIndex, 'uploading', pct);
                }
                callback(null, chunk);
            }
        });
        fs.createReadStream(resolvedPath).pipe(progressStream);

        const response = await youtube.videos.insert({
            part: ["snippet", "status"],
            requestBody: {
                snippet: {
                    title: title || originalName,
                    description: description || "",
                    tags: tags || [],
                },
                status: {
                    privacyStatus: privacyStatus || "private"
                }
            },
            media: { body: progressStream }
        });

        cleanup();

        emitProgress(instructorId, clientVideoIndex, 'done', 100);
        emitDone(instructorId, clientVideoIndex, response.data.id);
    } catch (error) {
        cleanup();
        console.error('YouTube upload error --->', (error as Error)?.message ?? error);

        // Auth-related failures trigger re-authentication
        const errorMessage = (error as Error)?.message ?? String(error);
        if (errorMessage.includes('invalid_grant') ||
            errorMessage.includes('auth') ||
            errorMessage.includes('unauthorized') ||
            errorMessage.includes('credentials') ||
            errorMessage.includes('token')) {
            try {
                emitReauth(instructorId, clientVideoIndex);
                return;
            } catch (authError) {
                console.error('Error generating auth URL:', authError);
            }
        }

        emitFailed(instructorId, clientVideoIndex, 'failed', errorMessage);
    }
};
