import { Request, Response } from "express";
import { google } from "googleapis";
import multer from "multer";
import { Instructor } from "../models/instructor.model";

const upload = multer({ storage: multer.memoryStorage() });

const handleDriveAuth = async (req: Request, res: Response) => {
    try {
        const instructorId = req.userId;

        if (!instructorId) {
            return res.status(401).json({
                status: "failed",
                message: "Unauthorized: Instructor ID not found"
            });
        }

        const instructor = await Instructor.findById(instructorId);
        if (instructor && instructor.driveTokens) {
            const hasValidToken = instructor.driveTokens.accessToken || instructor.driveTokens.refreshToken;
            if (hasValidToken) {
                return res.status(200).json({ authenticated: true });
            }
        }

        const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
        const redirectUri = process.env.GOOGLE_DRIVE_REDIRECT_URI;

        if (!clientId || !clientSecret || !redirectUri) {
            return res.status(500).json({
                status: "failed",
                message: "Google Drive credentials not configured"
            });
        }

        const oauth2Client = new google.auth.OAuth2(
            clientId,
            clientSecret,
            redirectUri
        );

        const authUrl = oauth2Client.generateAuthUrl({
            access_type: "offline",
            scope: ["https://www.googleapis.com/auth/drive.file"],
            prompt: "consent"
        });

        return res.status(200).json({ authenticated: false, authUrl });
    } catch (error) {
        console.error('Google Drive auth error --->', (error as Error)?.message ?? error);
        res.status(500).json({
            status: "failed",
            message: "Internal server error"
        });
    }
};

const handleDriveCallback = async (req: Request, res: Response) => {
    try {
        const { code } = req.query;
        const instructorId = req.userId;

        if (!code || typeof code !== "string") {
            return res.status(400).json({
                status: "failed",
                message: "Authorization code is required"
            });
        }

        if (!instructorId) {
            return res.status(401).json({
                status: "failed",
                message: "Unauthorized: Instructor ID not found"
            });
        }

        const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
        const redirectUri = process.env.GOOGLE_DRIVE_REDIRECT_URI;

        if (!clientId || !clientSecret || !redirectUri) {
            return res.status(500).json({
                status: "failed",
                message: "Google Drive credentials not configured"
            });
        }

        const oauth2Client = new google.auth.OAuth2(
            clientId,
            clientSecret,
            redirectUri
        );

        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);

        const instructor = await Instructor.findById(instructorId);
        if (!instructor) {
            return res.status(404).json({
                status: "failed",
                message: "Instructor not found"
            });
        }

        instructor.driveTokens = {
            accessToken: tokens.access_token || "",
            refreshToken: tokens.refresh_token || "",
            expiryDate: tokens.expiry_date ? Date.parse(tokens.expiry_date.toString()) : 0
        };

        await instructor.save();

        return res.status(200).json({
            status: "success",
            message: "Google Drive authentication successful"
        });
    } catch (error) {
        console.error('Google Drive callback error --->', (error as Error)?.message ?? error);
        res.status(500).json({
            status: "failed",
            message: "Internal server error"
        });
    }
};

const handleDriveUpload = async (req: Request, res: Response) => {
    try {
        const instructorId = req.userId;
        const { name } = req.body;
        const file = req.file;

        if (!instructorId) {
            return res.status(401).json({
                status: "failed",
                message: "Unauthorized: Instructor ID not found"
            });
        }

        if (!file) {
            return res.status(400).json({
                status: "failed",
                message: "No file provided"
            });
        }

        const instructor = await Instructor.findById(instructorId);
        if (!instructor || !instructor.driveTokens) {
            return res.status(400).json({
                status: "failed",
                message: "Google Drive authentication required. Please authenticate first."
            });
        }

        const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
        const redirectUri = process.env.GOOGLE_DRIVE_REDIRECT_URI;

        if (!clientId || !clientSecret || !redirectUri) {
            return res.status(500).json({
                status: "failed",
                message: "Google Drive credentials not configured"
            });
        }

        const oauth2Client = new google.auth.OAuth2(
            clientId,
            clientSecret,
            redirectUri
        );

        oauth2Client.setCredentials({
            access_token: instructor.driveTokens.accessToken,
            refresh_token: instructor.driveTokens.refreshToken
        });

        // Check if token needs refresh
        if (instructor.driveTokens.expiryDate && Date.now() > instructor.driveTokens.expiryDate) {
            const { credentials } = await oauth2Client.refreshAccessToken();
            if (credentials.access_token) {
                instructor.driveTokens.accessToken = credentials.access_token;
                if (credentials.expiry_date) {
                    instructor.driveTokens.expiryDate = Date.parse(credentials.expiry_date.toString());
                }
                await instructor.save();
            }
        }

        const drive = google.drive({ version: "v3", auth: oauth2Client });

        const fileMetadata = {
            name: name || file.originalname,
        };

        const media = {
            mimeType: file.mimetype,
            body: Buffer.from(file.buffer),
        };

        const response = await drive.files.create({
            requestBody: fileMetadata,
            media: media,
            fields: "id,webViewLink",
        });

        if (response.data) {
            return res.status(200).json({
                status: "success",
                message: "File uploaded to Google Drive successfully",
                url: response.data.webViewLink || `https://drive.google.com/file/d/${response.data.id}/view`,
                fileId: response.data.id
            });
        } else {
            return res.status(500).json({
                status: "failed",
                message: "Failed to upload file to Google Drive"
            });
        }
    } catch (error) {
        console.error('Google Drive upload error --->', (error as Error)?.message ?? error);
        res.status(500).json({
            status: "failed",
            message: "Internal server error during Google Drive upload"
        });
    }
};

export { handleDriveUpload, handleDriveAuth, handleDriveCallback, upload };
