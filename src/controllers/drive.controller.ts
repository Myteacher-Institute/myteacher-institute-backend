import { Request, Response } from "express";
import { google } from "googleapis";
import multer from "multer";
import path from "path";
import fs from "fs";
import { Instructor } from "../models/instructor.model";
import { enqueueDriveUpload } from "../queues";
import type { DriveUploadJob } from "../queues/types";

// Allowed base directory for uploaded assets — must match the multer destination
const ALLOWED_ASSET_DIR = path.resolve(
    process.env.ASSET_UPLOAD_DIR || path.join(process.cwd(), 'uploads', 'assets')
);

if (!fs.existsSync(ALLOWED_ASSET_DIR)) {
    fs.mkdirSync(ALLOWED_ASSET_DIR, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, ALLOWED_ASSET_DIR),
    filename: (_req, file, cb) => {
        const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        cb(null, `${unique}${path.extname(file.originalname)}`);
    },
});

const upload = multer({ storage });

const handleDriveAuth = async (req: Request, res: Response) => {
    try {
        const instructorId = req.userId;

        if (!instructorId) {
            return res.status(401).json({
                status: "failed",
                message: "Unauthorized: Instructor ID not found"
            });
        }

        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');

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
            expiryDate: tokens.expiry_date ? (typeof tokens.expiry_date === 'number' ? tokens.expiry_date : Date.parse(String(tokens.expiry_date))) : 0
        };

        await instructor.save();

        // Return HTML to close popup and redirect
        res.send(`
            <html>
                <head>
                    <style>
                        body {
                            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            height: 100vh;
                            margin: 0;
                            background: linear-gradient(135deg, #fff 0%, #84baf8 100%);
                        }
                        .container {
                            text-align: center;
                            padding: 40px;
                            background: white;
                            border-radius: 16px;
                            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                        }
                        .icon {
                            background: url(../assets/logo.png) no-repeat center center;
                            background-size: contain;
                            width: 100px;
                            height: 100px;
                            margin-bottom: 16px;
                        }
                        h1 {
                            color: #333;
                            margin: 0 0 8px 0;
                            font-size: 24px;
                        }
                        p {
                            color: #666;
                            margin: 0;
                            font-size: 14px;
                        }
                    </style>
                    <script>
                        window.opener.postMessage({ type: 'drive-auth-success' }, '*');
                        setTimeout(() => window.close(), 1500);
                    </script>
                </head>
                <body>
                    <div class="container">
                        <div class="icon"></div>
                        <h1>Authentication Successful</h1>
                        <p>Google Drive connected. This window will close automatically.</p>
                    </div>
                </body>
            </html>
        `);
    } catch (error) {
        console.error('Google Drive callback error --->', (error as Error)?.message ?? error);
        res.status(500).json({
            status: "failed",
            message: "Internal server error"
        });
    }
};

// Enqueue the upload and return immediately (202). The actual Drive upload
// runs on a BullMQ worker and reports progress/completion over the socket.
const handleDriveUpload = async (req: Request, res: Response) => {
    const uploadedFilePath = req.file?.path;

    const cleanup = () => {
        // Delete the temp file if we fail before it is enqueued.
        // Once enqueued, the worker owns cleanup.
        if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
            fs.unlink(uploadedFilePath, () => {});
        }
    };

    try {
        const instructorId = req.userId;
        const { name } = req.body;
        const file = req.file;

        if (!instructorId) {
            cleanup();
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

        // Verify the file path is inside the allowed upload directory
        const resolvedPath = path.resolve(file.path);
        if (!resolvedPath.startsWith(ALLOWED_ASSET_DIR + path.sep)) {
            console.error('Drive upload error: Invalid file path', { resolvedPath, ALLOWED_ASSET_DIR });
            cleanup();
            return res.status(400).json({ status: "failed", message: "Invalid file path" });
        }

        const clientAssetIndex = (() => {
            const raw = req.body.clientAssetIndex;
            if (typeof raw === 'number') return raw;
            if (typeof raw === 'string' && raw.trim() !== '') {
                const parsed = Number(raw);
                return Number.isNaN(parsed) ? undefined : parsed;
            }
            return undefined;
        })();

        const job: DriveUploadJob = {
            instructorId,
            filePath: resolvedPath,
            originalName: file.originalname,
            name: name || file.originalname,
            mimeType: file.mimetype,
            clientAssetIndex,
        };

        // Enqueue — the worker owns the file from here on
        await enqueueDriveUpload(job);

        return res.status(202).json({
            status: "queued",
            message: "File upload started. You will be notified when it finishes.",
        });
    } catch (error) {
        cleanup();
        console.error('Drive upload enqueue error --->', (error as Error)?.message ?? error);
        res.status(500).json({
            status: "failed",
            message: "Internal server error during Google Drive upload"
        });
    }
};

export { handleDriveUpload, handleDriveAuth, handleDriveCallback, upload };
