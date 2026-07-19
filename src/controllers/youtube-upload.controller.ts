import { Request, Response } from "express";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { google } from "googleapis";
import { YouTubeUploadReqBody, YouTubeUploadResT } from "../types/youtube.type";
import { Instructor } from "../models/instructor.model";
import { SCOPES, createOAuth2Client } from "../services/google-youtube.services";

// Allowed base directory — must match the multer destination in youtube.routes.ts
const ALLOWED_VIDEO_DIR = path.resolve(
    process.env.VIDEO_UPLOAD_DIR || path.join(process.cwd(), 'uploads', 'videos')
);

// #13 Sign OAuth state with HMAC so it can't be forged
const STATE_SECRET = process.env.OAUTH_STATE_SECRET || crypto.randomBytes(32).toString('hex');

const signState = (payload: object): string => {
    const b64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = crypto.createHmac('sha256', STATE_SECRET).update(b64).digest('base64url');
    return `${b64}.${sig}`;
};

const verifyState = (state: string): { instructorId: string } | null => {
    const parts = state.split('.');
    if (parts.length !== 2) return null;
    const [b64, sig] = parts;
    const expected = crypto.createHmac('sha256', STATE_SECRET).update(b64).digest('base64url');
    try {
        if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
        return JSON.parse(Buffer.from(b64, 'base64url').toString());
    } catch {
        return null;
    }
};

// Helper function to refresh tokens if expired
const refreshAccessToken = async (oAuth2Client: any, instructor: any) => {
    try {
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
    } catch (error) {
        console.error('Token refresh error --->', error);
        throw new Error('Failed to refresh access token');
    }
};

const handleUploadToYouTube = async (
    req: Request<{}, {}, YouTubeUploadReqBody> & { file?: Express.Multer.File },
    res: Response<YouTubeUploadResT>
) => {
    const uploadedFilePath = req.file?.path;

    const cleanup = () => {
        // Delete the temp file after upload (success or failure)
        if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
            fs.unlink(uploadedFilePath, () => {});
        }
    };

    try {
        const instructorId = req.userId;

        if (!instructorId) {
            cleanup();
            return res.status(401).json({
                status: "failed",
                message: "Unauthorized: Instructor ID not found"
            });
        }

        // File is required — multer puts it in req.file
        if (!req.file) {
            console.error('YouTube upload error: No file in req.file');
            return res.status(400).json({
                status: "failed",
                message: "No video file provided. Send the file as multipart/form-data with field name 'video'."
            });
        }

        // #12 Verify the file path is inside the allowed upload directory
        const resolvedPath = path.resolve(req.file.path);
        if (!resolvedPath.startsWith(ALLOWED_VIDEO_DIR + path.sep)) {
            console.error('YouTube upload error: Invalid file path', { resolvedPath, ALLOWED_VIDEO_DIR });
            cleanup();
            return res.status(400).json({ status: "failed", message: "Invalid file path" });
        }

        const { title, description, tags, privacyStatus } = req.body;

        // tags may come as a comma-separated string from FormData
        const parsedTags: string[] = Array.isArray(tags)
            ? tags
            : typeof tags === 'string' && tags.length > 0
                ? tags.split(',').map(t => t.trim())
                : [];

        const instructor = await Instructor.findById(instructorId);
        if (!instructor || !instructor.youtubeTokens) {
            console.error('YouTube upload error: No instructor or missing YouTube tokens', { instructorId, hasInstructor: !!instructor, hasTokens: !!instructor?.youtubeTokens });
            cleanup();
            return res.status(400).json({
                status: "failed",
                message: "YouTube authentication required. Please authenticate first."
            });
        }

        // Validate that tokens have required fields
        if (!instructor.youtubeTokens.accessToken && !instructor.youtubeTokens.refreshToken) {
            console.error('YouTube upload error: Invalid YouTube tokens', { 
                hasAccessToken: !!instructor.youtubeTokens.accessToken, 
                hasRefreshToken: !!instructor.youtubeTokens.refreshToken 
            });
            cleanup();
            return res.status(400).json({
                status: "failed",
                message: "Invalid YouTube tokens. Please authenticate again."
            });
        }

        // Check if file exists before attempting upload
        if (!fs.existsSync(resolvedPath)) {
            console.error('YouTube upload error: File not found', { resolvedPath });
            return res.status(400).json({
                status: "failed",
                message: "Video file not found. Please upload the file again."
            });
        }

        const oAuth2Client = createOAuth2Client(google);
        oAuth2Client.setCredentials({
            access_token: instructor.youtubeTokens.accessToken,
            refresh_token: instructor.youtubeTokens.refreshToken,
            expiry_date: instructor.youtubeTokens.expiryDate
        });

        if (instructor.youtubeTokens.expiryDate && instructor.youtubeTokens.expiryDate < Date.now()) {
            await refreshAccessToken(oAuth2Client, instructor);
        }

        const youtube = google.youtube({ version: "v3", auth: oAuth2Client });

        const response = await youtube.videos.insert({
            part: ["snippet", "status"],
            requestBody: {
                snippet: {
                    title: title || req.file.originalname,
                    description: description || "",
                    tags: parsedTags,
                },
                status: {
                    privacyStatus: privacyStatus || "private"
                }
            },
            media: { body: fs.createReadStream(resolvedPath) }
        });

        cleanup();

        return res.status(201).json({
            status: "success",
            message: "Video uploaded successfully to YouTube",
            videoId: response.data.id,
            videoUrl: `https://www.youtube.com/watch?v=${response.data.id}`
        });

    } catch (error) {
        cleanup();
        console.error('YouTube upload error --->', (error as Error)?.message ?? error);
        res.status(500).json({ status: "failed", message: "Internal server error" });
    }
};

const handleYouTubeAuth = async (req: Request, res: Response) => {
    try {
        const instructorId = req.userId;
        if (!instructorId) {
            return res.status(401).json({ status: "failed", message: "Unauthorized: Instructor ID not found" });
        }

        // Check if instructor already has valid YouTube tokens
        const instructor = await Instructor.findById(instructorId);
        if (instructor && instructor.youtubeTokens) {
            const hasValidToken = instructor.youtubeTokens.accessToken || instructor.youtubeTokens.refreshToken;
            if (hasValidToken) {
                return res.status(200).json({
                    status: "success",
                    message: "Already authenticated with YouTube",
                    authenticated: true,
                });
            }
        }

        const oAuth2Client = createOAuth2Client(google);

        // #13 Sign state with HMAC — prevents CSRF and state forgery
        const state = signState({ instructorId });
        const authUrl = oAuth2Client.generateAuthUrl({
            access_type: "offline",
            scope: SCOPES,
            state,
        });

        return res.status(200).json({
            status: "success",
            message: "Authentication URL generated",
            authenticated: false,
            authUrl,
        });

    } catch (error) {
        console.error('YouTube auth error --->', (error as Error)?.message ?? error);
        res.status(500).json({ status: "failed", message: "Internal server error" });
    }
};

const handleYouTubeCallback = async (req: Request, res: Response) => {
    try {
        const { code, state } = req.query;

        if (!code) {
            return res.status(400).json({ status: "failed", message: "Authorization code is required" });
        }
        if (!state || typeof state !== 'string') {
            return res.status(400).json({ status: "failed", message: "State parameter is required" });
        }

        // #13 Verify HMAC signature — rejects forged/tampered state
        const parsed = verifyState(state);
        if (!parsed || !parsed.instructorId) {
            return res.status(400).json({ status: "failed", message: "Invalid or tampered state parameter" });
        }

        const oAuth2Client = createOAuth2Client(google);
        const { tokens } = await oAuth2Client.getToken(code as string);
        oAuth2Client.setCredentials(tokens);

        await Instructor.findByIdAndUpdate(parsed.instructorId, {
            youtubeTokens: {
                accessToken: tokens.access_token,
                refreshToken: tokens.refresh_token,
                expiryDate: tokens.expiry_date
            }
        });

        return res.status(200).json({
            status: "success",
            message: "Authentication successful",
            tokens: {
                access_token: tokens.access_token,
                expiry_date: tokens.expiry_date
                // refresh_token intentionally omitted from response
            }
        });

    } catch (error) {
        console.error('YouTube callback error --->', (error as Error)?.message ?? error);
        res.status(500).json({ status: "failed", message: "Internal server error" });
    }
};

export { handleUploadToYouTube, handleYouTubeAuth, handleYouTubeCallback };
