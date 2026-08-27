import { Request } from 'express';
import { IUser } from './models/user.model';

declare global {
    namespace Express {
        interface Request {
            userId?: string;
            user?: {
                id: string;
                role: 'admin' | 'instructor' | 'user';
            };
        }
    }
}