import express, { type Express, type Request, type Response } from 'express';
import cors from 'cors';
import apiRouter from './routes/index';
import { setupSwagger } from './config/swagger';

export const createApp = (): Express => {
    const app = express();

    app.use(cors());
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    app.get('/', (_req: Request, res: Response) => {
        res.status(200).json({ status: 'ok', message: 'Service is running' });
    }); 

    // API routes
    app.use('/api', apiRouter);

    setupSwagger(app)

    return app;
};

export default createApp;
