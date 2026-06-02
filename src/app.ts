import cors from 'cors';
import express, { type Express, type Request, type Response } from 'express';
import { adminRouter, authRouter, courseRouter, paymentRouter, youtubeRouter, instructorRouter } from './routes';

export const createApp = (): Express => {
    const app = express();

    app.use(cors());
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    app.use('/api/auth', authRouter);
    app.use("/api/admin", adminRouter);
    app.use("/api/course", courseRouter);
    app.use("/api/payment", paymentRouter);
    app.use("/api/youtube", youtubeRouter);
    app.use("/api/instructor", instructorRouter);

    app.get('/', (_req: Request, res: Response) => {
        res.status(200).json({ status: 'ok', message: 'Service is running' });
    });

    return app;
};

export default createApp;
