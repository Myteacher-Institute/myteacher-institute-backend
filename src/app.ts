import cors from 'cors';
import { adminRouter, authRouter, courseRouter, paymentRouter, youtubeRouter, instructorRouter } from './routes';
import path from 'path';
import { configureScalarDocs } from './config/scalar';
import express, { type Express, type Request, type Response } from 'express';

import morgan from 'morgan';

const createApp = (): Express => {
    const app = express();

    app.use(cors({
        origin: ['http://localhost:3000'],
    }));
    
    app.use(express.json());
    app.use(express.urlencoded({ limit: '100mb', extended: true }));
    app.use('/assets', express.static(path.join(process.cwd(), 'src', 'assets')));
    app.use(morgan('tiny'));
    app.use(express.json({ limit: '100mb' }));

    app.use('/api/auth', authRouter);
    app.use("/api/admin", adminRouter);
    app.use("/api/course", courseRouter);
    app.use("/api/payment", paymentRouter);
    app.use("/api/youtube", youtubeRouter);
    app.use("/api/instructor", instructorRouter);

    app.get('/', (_req: Request, res: Response) => {
        res.status(200).json({ status: 'ok', message: 'Service is running' });
    });

    // Scalar API documentation
    configureScalarDocs(app);

    return app;
};

export default createApp;