import cors from 'cors';
import { adminRouter, authRouter, courseRouter, paymentRouter, youtubeRouter, instructorRouter, driveRouter, userRouter, affiliateRouter, studentRouter, notificationRouter, mentorRouter, chatRouter, pusherRouter, instructorReportRouter } from './routes';
import path from 'path';
import { configureScalarDocs } from './config/scalar';
import express, { type Express, type NextFunction, type Request, type Response, type Router } from 'express';
import cookieParser from 'cookie-parser';
import { buildFastApiRouter } from './router/fast-api-router';

import morgan from 'morgan';

// Every API namespace registers here (Express) AND on a find-my-way radix-tree
// router (mounted first for O(1) route matching). Anything the fast router
// can't match falls through to the normal Express routers, so no route is lost.
const apiRouters: { path: string; router: Router }[] = [
    { path: '/auth', router: authRouter },
    { path: '/admin', router: adminRouter },
    { path: '/course', router: courseRouter },
    { path: '/payment', router: paymentRouter },
    { path: '/youtube', router: youtubeRouter },
    { path: '/instructor', router: instructorRouter },
    { path: '/drive', router: driveRouter },
    { path: '/user', router: userRouter },
    { path: '/affiliate', router: affiliateRouter },
    { path: '/student', router: studentRouter },
    { path: '/notification', router: notificationRouter },
    { path: '/mentor', router: mentorRouter },
    { path: '/chat', router: chatRouter },
    { path: '/pusher', router: pusherRouter },
    { path: '/reports', router: instructorReportRouter },
];

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
    // JSON limit sized for the largest chat-file upload: a 100 MB file encodes
    // to ~133 MB of base64 text. Large chat files are stored in MongoDB via
    // GridFS (never on the filesystem), so this body limit is the ceiling.
    app.use(express.json({ limit: '200mb' }));
    app.use(express.urlencoded({ limit: '200mb', extended: true }));
    app.use('/assets', express.static(path.join(process.cwd(), 'src', 'assets')));
    app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
    app.use(morgan('tiny'));

    // Fast radix-tree router for all API routes (falls back to Express below).
    const fastApi = buildFastApiRouter(apiRouters);
    app.use('/api', fastApi);

    // Express routers — authoritative fallback + source of truth for what's mounted.
    for (const { path, router } of apiRouters) {
        app.use(`/api${path}`, router);
    }

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