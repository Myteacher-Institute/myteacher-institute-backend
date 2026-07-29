import cors from 'cors';
import { adminRouter, authRouter, courseRouter, paymentRouter, youtubeRouter, instructorRouter, notificationRouter, driveRouter, userRouter } from './routes';
import path from 'path';
import { configureScalarDocs } from './config/scalar';
import express, { type Express, type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import morgan from 'morgan';

// Allowed origins: read from env in production, fallback to localhost for dev
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : ['http://localhost:3000'];

const createApp = (): Express => {
    const app = express();

    // #8 CORS — environment-driven allowlist, explicit rejection of unknown origins
    app.use(cors({
        origin: (origin, callback) => {
            // Allow server-to-server requests (no origin) only in development
            if (!origin) {
                if (process.env.NODE_ENV === 'production') {
                    return callback(new Error('Origin required in production'), false);
                }
                return callback(null, true);
            }
            if (ALLOWED_ORIGINS.includes(origin)) {
                return callback(null, true);
            }
            return callback(new Error(`CORS: origin ${origin} not allowed`), false);
        },
        credentials: true,
    }));

    app.use(cookieParser());

    // #27 Helmet — security headers (CSP, X-Frame-Options, X-Content-Type, etc.)
    app.use(helmet({
        crossOriginResourcePolicy: { policy: 'same-site' },
    }));

    // JSON bodies: 10mb covers base64-encoded images; file uploads should use multipart/form-data
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ limit: '10mb', extended: true }));
    app.use('/api/assets', express.static(path.join(process.cwd(), 'src', 'assets')));
    app.use(morgan('tiny'));

    app.use('/api/auth', authRouter);
    app.use("/api/admin", adminRouter);
    app.use("/api/course", courseRouter);
    app.use("/api/payment", paymentRouter);
    app.use("/api/youtube", youtubeRouter);
    app.use("/api/instructor", instructorRouter);
    app.use("/api/notifications", notificationRouter);
    app.use("/api/drive", driveRouter);
    app.use("/api/user", userRouter);

    // Health check endpoint for socket connection availability
    app.get('/health', (_req: Request, res: Response) => {
        res.status(200).json({ status: 'ok', message: 'Service is healthy' });
    });

    app.get('/', (_req: Request, res: Response) => {
        res.status(200).json({ status: 'ok', message: 'Service is running' });
    });

    // Scalar API documentation
    configureScalarDocs(app);

    return app;
};

export default createApp;