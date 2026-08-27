import cors from 'cors';
import { adminRouter, authRouter, courseRouter, paymentRouter, youtubeRouter, instructorRouter, driveRouter, userRouter, affiliateRouter, studentRouter, notificationRouter, mentorRouter } from './routes';
import path from 'path';
import { configureScalarDocs } from './config/scalar';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';

import morgan from 'morgan';

const createApp = (): Express => {
    const app = express();

    const allowedOrigins = process.env.ALLOWED_ORIGINS
        ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
        : ['http://localhost:3000'];

    app.use(cors({
        origin: allowedOrigins,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
    }));
    
    app.use(cookieParser());
    // Keep the JSON limit bounded — large payloads (profile pictures, files) go
    // through multer/multipart, never JSON. 10mb still covers the base64
    // profile picture sent during the apply-as-instructor flow until it is
    // migrated to the file-upload route too.
    app.use(express.json({ limit: '100mb' }));
    app.use(express.urlencoded({ limit: '100mb', extended: true }));
    app.use('/assets', express.static(path.join(process.cwd(), 'src', 'assets')));
    app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
    app.use(morgan('tiny'));

    app.use('/api/auth', authRouter);
    app.use("/api/admin", adminRouter);
    app.use("/api/course", courseRouter);
    app.use("/api/payment", paymentRouter);
    app.use("/api/youtube", youtubeRouter);
    app.use("/api/instructor", instructorRouter);
    app.use("/api/drive", driveRouter);
    app.use("/api/user", userRouter);
    app.use("/api/affiliate", affiliateRouter);
    app.use("/api/student", studentRouter);
    app.use("/api/notification", notificationRouter);
    app.use("/api/mentor", mentorRouter);

    app.get('/', (_req: Request, res: Response) => {
        res.status(200).json({ status: 'ok', message: 'Service is running' });
    });

    // Scalar API documentation
    configureScalarDocs(app);

    // JSON error handler — keeps body-parser / multer failures as JSON instead
    // of Express's default HTML responses.
    app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
        const error = err as { type?: string; name?: string; message?: string };
        console.error('API error --->', error?.message ?? error);
        if (error?.type === 'entity.too.large') {
            return res.status(413).json({ status: 'failed', message: 'Request body too large' });
        }
        if (error?.name === 'MulterError') {
            const message = error.message === 'File too large'
                ? 'Image size must not exceed 6MB'
                : error.message || 'Upload failed';
            return res.status(400).json({ status: 'failed', message });
        }
        if (error?.message && /only (image|video) files are allowed/i.test(error.message)) {
            return res.status(400).json({ status: 'failed', message: error.message });
        }
        return res.status(500).json({ status: 'failed', message: 'Internal server error' });
    });

    return app;
};

export default createApp;