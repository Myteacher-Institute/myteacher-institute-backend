import { Request, Response, NextFunction } from 'express';
import config from '../config/env';
import jwt from 'jsonwebtoken';
<<<<<<< HEAD
=======
import { Session } from '../models/session.model';
>>>>>>> 57944771c3fb2d594abfe715b99d915687deb87e

export type ProtectMiddleWareErrorT =
  | { message: string; type: 'no-auth' }
  | { message: string; type: 'no-refresh' }
  | { message: string; type: 'request-access' }
  | { message: string; type: 'invalid-auth' }
  | { message: string; type: 'server-error' };

export const ProtectMiddleWare = async (
  req: Request,
  res: Response<ProtectMiddleWareErrorT>,
  next: NextFunction
) => {
  try {
<<<<<<< HEAD
    const accessTokenSecret = config['JWT_ACCESS_TOKEN_SECRET'];
    const refreshTokenSecret = config['JWT_REFRESH_TOKEN_SECRET'];
    const REFRESH_TOKEN_COOKIE_NAME = config['REFRESH_TOKEN_COOKIE_NAME'];
=======
    const accessTokenSecret = config['JWT_ACCESS_TOKEN_SECRET'] as string;
    const refreshTokenSecret = config['JWT_REFRESH_TOKEN_SECRET'] as string;
    const REFRESH_TOKEN_COOKIE_NAME = config['REFRESH_TOKEN_COOKIE_NAME'] as string;
>>>>>>> 57944771c3fb2d594abfe715b99d915687deb87e

    const authorizationHeader = req.headers['authorization'];
    const refreshToken = req.cookies[REFRESH_TOKEN_COOKIE_NAME];

<<<<<<< HEAD
    // 1. check both are present
    if (!authorizationHeader) {
      return res.status(401).json({
        message: 'Authorization header is required',
=======
    // 1. check if at least one is present
    if (!authorizationHeader && !refreshToken) {
      return res.status(401).json({
        message: 'Authorization header or refresh token cookie is required',
>>>>>>> 57944771c3fb2d594abfe715b99d915687deb87e
        type: 'no-auth',
      });
    }

<<<<<<< HEAD
    if (!refreshToken) {
      return res.status(401).json({
        message: 'Refresh token cookie is required',
        type: 'no-refresh',
      });
    }

    // 2. extract access token
    const accessToken = authorizationHeader.split(' ')[1];

    if (!accessToken) {
      return res.status(401).json({
        message: 'Invalid authorization format',
        type: 'no-auth',
      });
    }

    // 3. try access token first
    try {
      const decoded = jwt.verify(accessToken, accessTokenSecret) as { userId: string };
      req.userId = decoded.userId;
      return next();
    } catch {
      // access token failed, fall through to refresh token
    }

    // 4. access token failed, try refresh token
    try {
      const refreshDecoded = jwt.verify(refreshToken, refreshTokenSecret) as { userId: string };

      const newAccessToken = jwt.sign({ userId: refreshDecoded.userId }, accessTokenSecret, {
        expiresIn: '15m',
      });

      req.userId = refreshDecoded.userId;
      res.setHeader('Authorization', `Bearer ${newAccessToken}`);
      return next();
    } catch {
      // refresh token also failed, user needs to log in again
      return res.status(401).json({
        message: 'Session expired, please log in again',
        type: 'request-access',
      });
    }
=======
    // 2. try access token first if present
    if (authorizationHeader) {
      const accessToken = authorizationHeader.split(' ')[1];

      if (accessToken) {
        try {
          const decoded = jwt.verify(accessToken, accessTokenSecret) as { userId: string; sessionId: string };

          // Validate session exists, is not revoked, and has not expired
          const session = await Session.findOne({
            _id: decoded.sessionId,
            userId: decoded.userId,
            isRevoked: false,
          });

          if (session && session.expiresAt > new Date()) {
            // Update lastActive timestamp without blocking the request
            Session.updateOne({ _id: session._id }, { $set: { lastActive: new Date() } }).catch(() => {});
            req.userId = decoded.userId;
            return next();
          }
          // Session not found, revoked, or expired — fall through to refresh token
        } catch {
          // access token failed, fall through to refresh token
        }
      }
    }

    // 3. access token failed or not present, try refresh token
    if (refreshToken) {
      try {
        const refreshDecoded = jwt.verify(refreshToken, refreshTokenSecret) as { userId: string; sessionId: string };

        if (!refreshDecoded.sessionId) {
          return res.status(401).json({
            message: 'Malformed token, please log in again',
            type: 'request-access',
          });
        }

        // Validate session in database — catches revoked sessions and post-logout tokens
        const session = await Session.findOne({
          _id: refreshDecoded.sessionId,
          userId: refreshDecoded.userId,
          isRevoked: false,
        });

        if (!session) {
          return res.status(401).json({
            message: 'Session not found or has been revoked, please log in again',
            type: 'request-access',
          });
        }

        if (session.expiresAt <= new Date()) {
          return res.status(401).json({
            message: 'Session expired, please log in again',
            type: 'request-access',
          });
        }

        // Session is valid — issue a new access token with sessionId embedded
        const { generateJWT } = await import('../utils');
        const newAccessToken = generateJWT({
          userId: refreshDecoded.userId,
          sessionId: refreshDecoded.sessionId,
          type: 'access',
        });

        // Update lastActive without blocking
        Session.updateOne({ _id: session._id }, { $set: { lastActive: new Date() } }).catch(() => {});

        req.userId = refreshDecoded.userId;
        res.setHeader('Authorization', `Bearer ${newAccessToken}`);
        return next();
      } catch {
        // refresh token also failed (signature invalid, expired JWT)
        return res.status(401).json({
          message: 'Session expired, please log in again',
          type: 'request-access',
        });
      }
    }

    // 4. neither token worked
    return res.status(401).json({
      message: 'Invalid or expired tokens, please log in again',
      type: 'invalid-auth',
    });
>>>>>>> 57944771c3fb2d594abfe715b99d915687deb87e
  } catch (error) {
    console.error('ProtectMiddleWare error --->', (error as Error)?.message ?? error);
    return res.status(500).json({ message: 'INTERNAL_SERVER_ERROR', type: 'server-error' });
  }
};

