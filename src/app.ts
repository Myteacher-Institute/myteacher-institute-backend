import express, { type Express, type Request, type Response } from 'express';
import cors from 'cors';
import path from 'path';
import apiRouter from './routes/index';
import { configureScalarDocs } from './config/scalar';


export const createApp = (): Express => {
    const app = express();

    app.use(cors());
    app.use('/assets', express.static(path.join(process.cwd(), 'src', 'assets')));

    app.get('/', (_req: Request, res: Response) => {
        res.status(200).json({ status: 'ok', message: 'Service is running. Please check /api/docs for API documentation' });
    });

    // API routes
    app.use('/api', apiRouter);

    // Scalar API documentation
    configureScalarDocs(app);

    return app;
};

export default createApp;
