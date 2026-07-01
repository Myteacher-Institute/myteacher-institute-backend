import jwt from 'jsonwebtoken';
import { Request } from 'express';

import config from '../config/env';
import logger, { generateJWT } from '../utils';
import { HandleGetAccessTokenResponseT } from '../types/auth.types';

export const getAccessToken = (
    req: Request
): { status: number; body: HandleGetAccessTokenResponseT } => {
    try {
        const refreshCookieName = config['REFRESH_TOKEN_COOKIE_NAME'];
        const refreshTokenSecret = config['JWT_REFRESH_TOKEN_SECRET'];
        const refreshCookie = req.cookies[refreshCookieName];

        if (!refreshCookie) {
            return { status: 401, body: { type: 'no-refresh', message: 'No refresh token found. Please log in again.' } };
        }

        try {
            const decoded = jwt.verify(refreshCookie, refreshTokenSecret) as { userId: string; sessionId: string };

            const newAccessToken = generateJWT({ userId: decoded.userId, type: 'access', sessionId: decoded.sessionId });

            return { status: 200, body: { type: 'success', message: 'Access token generated successfully', accessToken: newAccessToken as string } };
        } catch {
            return { status: 401, body: { type: 'invalid-refresh', message: 'Invalid or expired refresh token. Please log in again.' } };
        }
    } catch (error) {
        logger.error(`Error on @getAccessToken: ${(error as Error)?.message ?? error}`);
        return { status: 500, body: { type: 'server-error', message: 'Internal server error occurred' } };
    }
};
