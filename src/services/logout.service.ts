import jwt from 'jsonwebtoken';
import { Request } from 'express';
import config from '../config/env';
import { Session } from '../models/session.model';
import logger from '../utils';

type LogoutResult = { status: number; body: { status: 'success' | 'failed'; message: string } };

/**
 * Revokes the current session identified by the refresh token cookie.
 * Clears the cookie from the response regardless of outcome so the client
 * is always logged out from its side.
 */
export const logoutUser = async (req: Request): Promise<LogoutResult> => {
    try {
        const refreshCookieName = config['REFRESH_TOKEN_COOKIE_NAME'] as string;
        const refreshTokenSecret = config['JWT_REFRESH_TOKEN_SECRET'] as string;
        const refreshCookie = req.cookies[refreshCookieName];

        if (!refreshCookie) {
            return { status: 200, body: { status: 'success', message: 'Logged out successfully' } };
        }

        try {
            const decoded = jwt.verify(refreshCookie, refreshTokenSecret) as { userId: string; sessionId: string };

            if (decoded.sessionId) {
                await Session.updateOne(
                    { _id: decoded.sessionId, userId: decoded.userId, isRevoked: false },
                    { $set: { isRevoked: true, revokedAt: new Date(), logoutAt: new Date() } }
                );
            }
        } catch {
            // Token is invalid/expired — session may already be gone, that's fine
        }

        return { status: 200, body: { status: 'success', message: 'Logged out successfully' } };
    } catch (error) {
        logger.error(`Error on @logoutUser: ${(error as Error)?.message ?? error}`);
        return { status: 500, body: { status: 'failed', message: 'Internal server error' } };
    }
};

/**
 * Revokes ALL sessions for a given userId (logout from all devices).
 */
export const logoutAllDevices = async (userId: string): Promise<LogoutResult> => {
    try {
        await Session.updateMany(
            { userId, isRevoked: false },
            { $set: { isRevoked: true, revokedAt: new Date(), logoutAt: new Date() } }
        );
        return { status: 200, body: { status: 'success', message: 'Logged out from all devices successfully' } };
    } catch (error) {
        logger.error(`Error on @logoutAllDevices: ${(error as Error)?.message ?? error}`);
        return { status: 500, body: { status: 'failed', message: 'Internal server error' } };
    }
};
