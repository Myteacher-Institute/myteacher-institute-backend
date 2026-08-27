import fs from "fs";
import path from "path";
import { Transform } from "stream";
import { google } from "googleapis";
import { Instructor } from "../models/instructor.model";
import { emitToUser } from "../config/socket";
import type { DriveUploadJob } from "../queues/types";
import { recordDriveResult, failCourseCreation, trackCourseCreationUploadProgress } from "../services/course-creation.service";

const ALLOWED_ASSET_DIR = path.resolve(
    process.env.ASSET_UPLOAD_DIR || path.join(process.cwd(), 'uploads', 'assets')
);

const emitProgress = (instructorId: string, assetIndex: number | undefined, stage: string, percent?: number) => {
    try {
        emitToUser(instructorId, 'drive-upload:progress', {
            assetIndex: typeof assetIndex === 'number' ? assetIndex : undefined,
            stage,
            percent: typeof percent === 'number' ? Math.max(0, Math.min(100, Math.round(percent))) : undefined,
            timestamp: Date.now()
        });
    } catch {
        // best-effort only
    }
};

const emitDone = (instructorId: string, assetIndex: number | undefined, url: string, fileId: string) => {
    try {
        emitToUser(instructorId, 'drive-upload:done', {
            assetIndex: typeof assetIndex === 'number' ? assetIndex : undefined,
            url,
            fileId,
            timestamp: Date.now()
        });
    } catch {
        // best-effort only
    }
};

const emitFailed = (instructorId: string, assetIndex: number | undefined, message: string) => {
    try {
        emitToUser(instructorId, 'drive-upload:failed', {
            assetIndex: typeof assetIndex === 'number' ? assetIndex : undefined,
            status: 'failed',
            message,
            timestamp: Date.now()
        });
    } catch {
        // best-effort only
    }
};

const getDriveCredentials = () => {
    const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_DRIVE_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
        throw new Error('Google Drive credentials not configured');
    }

    return { clientId, clientSecret, redirectUri };
};

export const processDriveUpload = async (job: DriveUploadJob): Promise<void> => {
    const { instructorId, filePath, name, mimeType, clientAssetIndex, courseCreationJobId } = job;

    const trackProgress = (percent: number | undefined) => {
        if (courseCreationJobId && typeof percent === 'number') {
            trackCourseCreationUploadProgress(courseCreationJobId, percent).catch(() => {});
        }
    };

    const cleanup = () => {
        if (filePath && fs.existsSync(filePath)) {
            fs.unlink(filePath, () => {});
        }
    };

    try {
        const resolvedPath = path.resolve(filePath);
        if (!resolvedPath.startsWith(ALLOWED_ASSET_DIR + path.sep)) {
            throw new Error('Invalid file path');
        }

        if (!fs.existsSync(resolvedPath)) {
            throw new Error('File not found. Please upload the file again.');
        }

        const instructor = await Instructor.findById(instructorId);
        if (!instructor || !instructor.driveTokens) {
            cleanup();
            emitFailed(instructorId, clientAssetIndex, "Google Drive authentication required. Please authenticate first.");
            return;
        }

        const { clientId, clientSecret, redirectUri } = getDriveCredentials();
        const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
        oauth2Client.setCredentials({
            access_token: instructor.driveTokens.accessToken,
            refresh_token: instructor.driveTokens.refreshToken
        });

        // Check if token needs refresh
        if (instructor.driveTokens.expiryDate && Date.now() > instructor.driveTokens.expiryDate) {
            try {
                const { credentials } = await oauth2Client.refreshAccessToken();
                if (credentials.access_token) {
                    instructor.driveTokens.accessToken = credentials.access_token;
                    if (credentials.expiry_date) {
                        instructor.driveTokens.expiryDate = typeof credentials.expiry_date === 'number' ? credentials.expiry_date : Date.parse(String(credentials.expiry_date));
                    }
                    await instructor.save();
                }
            } catch (error) {
                cleanup();
                console.error('Drive token refresh error --->', (error as Error)?.message ?? error);
                emitFailed(instructorId, clientAssetIndex, "Google Drive authentication expired. Please re-authenticate and try again.");
                return;
            }
        }

        const drive = google.drive({ version: "v3", auth: oauth2Client });

        emitProgress(instructorId, clientAssetIndex, 'preparing', 0);
        trackProgress(0);

        const totalBytes = fs.statSync(resolvedPath).size;
        let uploadedBytes = 0;
        let lastEmittedPercent = -1;
        let lastTrackedPercent = -1;
        const progressStream = new Transform({
            transform(chunk: Buffer, _encoding, callback) {
                uploadedBytes += chunk.length;
                const pct = Math.min(99, Math.max(1, Math.round((uploadedBytes / totalBytes) * 100)));
                if (pct !== lastEmittedPercent) {
                    lastEmittedPercent = pct;
                    emitProgress(instructorId, clientAssetIndex, 'uploading', pct);
                }
                if (courseCreationJobId && pct - lastTrackedPercent >= 5) {
                    lastTrackedPercent = pct;
                    trackProgress(pct);
                }
                callback(null, chunk);
            }
        });
        fs.createReadStream(resolvedPath).pipe(progressStream);

        const response = await drive.files.create({
            requestBody: { name: name || path.basename(resolvedPath) },
            media: {
                mimeType,
                body: progressStream,
            },
            fields: "id,webViewLink",
        });

        const url = response.data.webViewLink || `https://drive.google.com/file/d/${response.data.id}/view`;

        // Persist the finished URL into the durable course-creation job BEFORE
        // cleanup, so a crash between upload-success and cleanup never loses it.
        if (courseCreationJobId && typeof clientAssetIndex === 'number') {
            await recordDriveResult(courseCreationJobId, clientAssetIndex, url, response.data.id || undefined);
        }

        cleanup();

        emitProgress(instructorId, clientAssetIndex, 'done', 100);
        emitDone(instructorId, clientAssetIndex, url, response.data.id || '');
    } catch (error) {
        cleanup();
        console.error('Drive upload error --->', (error as Error)?.message ?? error);
        const message = (error as Error)?.message ?? "Failed to upload file to Google Drive";
        if (courseCreationJobId) {
            await failCourseCreation(courseCreationJobId, message);
        }
        emitFailed(instructorId, clientAssetIndex, message);
    }
};
