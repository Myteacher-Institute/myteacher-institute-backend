import { Request, Response } from "express";
import fs from "fs";
import { google } from "googleapis";
import { YouTubeUploadReqBody, YouTubeUploadResT } from "../types/youtube.type";
import { addCourseValidation } from "../services/course.services";
import { Instructor } from "../models/instructor.model";
import { CLIENT_SECRET_PATH, SCOPES, loadClientSecrets, createOAuth2Client } from "../services/google-youtube.services";

// Helper function to refresh tokens if expired
const refreshAccessToken = async (oAuth2Client: any, instructor: any) => {
    try {
        const { credentials } = await oAuth2Client.refreshAccessToken();
        oAuth2Client.setCredentials(credentials);
        
        // Update tokens in database
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

const handleUploadToYouTube = async (req: Request<{}, {}, YouTubeUploadReqBody>, res: Response<YouTubeUploadResT>) => {
    try {
        const instructorId = req.userId;

        // Validate request body and instructor ID
        const validation = addCourseValidation(req.body, instructorId);
        if (!validation.isValid) {
            return res.status(instructorId ? 400 : 401).json({
                status: "failed",
                message: validation.message
            });
        }

        const { videoPath, title, description, tags, privacyStatus } = req.body;

        // Check if video file exists
        if (!fs.existsSync(videoPath)) {
            return res.status(404).json({
                status: "failed",
                message: "Video file not found"
            });
        }

        // Get instructor with YouTube tokens
        const instructor = await Instructor.findById(instructorId);
        if (!instructor || !instructor.youtubeTokens) {
            return res.status(400).json({
                status: "failed",
                message: "YouTube authentication required. Please authenticate first."
            });
        }

        // Create OAuth2 client
        const oAuth2Client = createOAuth2Client(google);

        // Set credentials from database
        oAuth2Client.setCredentials({
            access_token: instructor.youtubeTokens.accessToken,
            refresh_token: instructor.youtubeTokens.refreshToken,
            expiry_date: instructor.youtubeTokens.expiryDate
        });

        // Check if token is expired and refresh if needed
        const now = Date.now();
        if (instructor.youtubeTokens.expiryDate && instructor.youtubeTokens.expiryDate < now) {
            await refreshAccessToken(oAuth2Client, instructor);
        }

        // Initialize YouTube API
        const youtube = google.youtube({
            version: "v3",
            auth: oAuth2Client
        });

        // Prepare video metadata
        const videoMetadata = {
            snippet: {
                title: title || "Uploaded Video",
                description: description || "",
                tags: tags || []
            },
            status: {
                privacyStatus: privacyStatus || "private"
            }
        };

        // Upload video
        const response = await youtube.videos.insert({
            part: ["snippet", "status"],
            requestBody: videoMetadata,
            media: {
                body: fs.createReadStream(videoPath)
            }
        });

        const videoId = response.data.id;

        return res.status(201).json({
            status: "success",
            message: "Video uploaded successfully to YouTube",
            videoId: videoId,
            videoUrl: `https://www.youtube.com/watch?v=${videoId}`
        });

    } catch (error) {
        console.error('YouTube upload error --->', (error as Error)?.message ?? error);
        res.status(500).json({
            status: "failed",
            message: "Internal server error"
        });
    }
};

const handleYouTubeAuth = async (req: Request, res: Response) => {
    try {
        const instructorId = req.userId;

        if (!instructorId) {
            return res.status(401).json({
                status: "failed",
                message: "Unauthorized: Instructor ID not found"
            });
        }

        // Create OAuth2 client
        const oAuth2Client = createOAuth2Client(google);

        // Generate auth URL with state containing instructorId
        const state = Buffer.from(JSON.stringify({ instructorId })).toString('base64');
        const authUrl = oAuth2Client.generateAuthUrl({
            access_type: "offline",
            scope: SCOPES,
            state: state
        });

        return res.status(200).json({
            status: "success",
            message: "Authentication URL generated",
            authUrl: authUrl
        });

    } catch (error) {
        console.error('YouTube auth error --->', (error as Error)?.message ?? error);
        res.status(500).json({
            status: "failed",
            message: "Internal server error"
        });
    }
};

const handleYouTubeCallback = async (req: Request, res: Response) => {
    try {
        const { code, state } = req.query;

        if (!code) {
            return res.status(400).json({
                status: "failed",
                message: "Authorization code is required"
            });
        }

        if (!state) {
            return res.status(400).json({
                status: "failed",
                message: "State parameter is required"
            });
        }

        // Decode state to get instructorId
        const { instructorId } = JSON.parse(Buffer.from(state as string, 'base64').toString());

        // Create OAuth2 client
        const oAuth2Client = createOAuth2Client(google);

        // Exchange code for tokens
        const { tokens } = await oAuth2Client.getToken(code as string);
        oAuth2Client.setCredentials(tokens);

        // Save tokens to database
        await Instructor.findByIdAndUpdate(instructorId, {
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
                refresh_token: tokens.refresh_token,
                expiry_date: tokens.expiry_date
            }
        });

    } catch (error) {
        console.error('YouTube callback error --->', (error as Error)?.message ?? error);
        res.status(500).json({
            status: "failed",
            message: "Internal server error"
        });
    }
};

export { handleUploadToYouTube, handleYouTubeAuth, handleYouTubeCallback };
