import jwt from 'jsonwebtoken';
import { Request } from 'express';

import config from '../config/env';
import logger, { generateJWT } from '../utils';
import { HandleGetAccessTokenResponseT } from '../types/auth.types';
import { Session } from '../models/session.model';

export const getAccessToken = async (
    req: Request
): Promise<{ status: number; body: HandleGetAccessTokenResponseT }> => {
    try {
        const refreshCookieName = config['REFRESH_TOKEN_COOKIE_NAME'] as string;
        const refreshTokenSecret = config['JWT_REFRESH_TOKEN_SECRET'] as string;
        const refreshCookie = req.cookies[refreshCookieName];

        if (!refreshCookie) {
            return { status: 401, body: { type: 'no-refresh', message: 'No refresh token found. Please log in again.' } };
        }

        let decoded: { userId: string; sessionId: string };
        try {
            decoded = jwt.verify(refreshCookie, refreshTokenSecret) as { userId: string; sessionId: string };
        } catch {
            return { status: 401, body: { type: 'invalid-refresh', message: 'Invalid or expired refresh token. Please log in again.' } };
        }

        if (!decoded.sessionId) {
            return { status: 401, body: { type: 'invalid-refresh', message: 'Malformed token. Please log in again.' } };
        }

        // Validate session exists, is not revoked, and has not expired
        const session = await Session.findOne({
            _id: decoded.sessionId,
            userId: decoded.userId,
            isRevoked: false,
        });

        if (!session) {
            return { status: 401, body: { type: 'invalid-refresh', message: 'Session not found or has been revoked. Please log in again.' } };
        }

        if (session.expiresAt <= new Date()) {
            return { status: 401, body: { type: 'invalid-refresh', message: 'Session expired. Please log in again.' } };
        }

        // Update lastActive without blocking the response
        Session.updateOne({ _id: session._id }, { $set: { lastActive: new Date() } }).catch(() => {});

        const newAccessToken = generateJWT({ userId: decoded.userId, type: 'access', sessionId: decoded.sessionId });

        return { status: 200, body: { type: 'success', message: 'Access token generated successfully', accessToken: newAccessToken as string } };
    } catch (error) {
        logger.error(`Error on @getAccessToken: ${(error as Error)?.message ?? error}`);
        return { status: 500, body: { type: 'server-error', message: 'Internal server error occurred' } };
    }
};
