import cors from 'cors';
<<<<<<< HEAD
import express, { type Express, type Request, type Response } from 'express';
import { adminRouter, authRouter, courseRouter, paymentRouter, youtubeRouter, instructorRouter } from './routes';
=======
import path from 'path';
import apiRouter from './routes/index';
import { configureScalarDocs } from './config/scalar';
import express, { type Express, type Request, type Response } from 'express';
>>>>>>> messiah/feat-auth-polish

const createApp = (): Express => {
    const app = express();

    app.use(cors());
    app.use('/assets', express.static(path.join(process.cwd(), 'src', 'assets')));

<<<<<<< HEAD
    app.use('/api/auth', authRouter);
    app.use("/api/admin", adminRouter);
    app.use("/api/course", courseRouter);
    app.use("/api/payment", paymentRouter);
    app.use("/api/youtube", youtubeRouter);
    app.use("/api/instructor", instructorRouter);

    app.get('/', (_req: Request, res: Response) => {
        res.status(200).json({ status: 'ok', message: 'Service is running' });
    });
=======
    app.get('/', (_req: Request, res: Response) => {
        res.status(200).json({ status: 'ok', message: 'Service is running. Please check /api/docs for API documentation' });
    });

    // API routes
    app.use('/api', apiRouter);

    // Scalar API documentation
    configureScalarDocs(app);
>>>>>>> messiah/feat-auth-polish

    return app;
};

export default createApp;
