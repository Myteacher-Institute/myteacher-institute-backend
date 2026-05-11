import { Request, Response, NextFunction } from 'express';
import config from '../config/env';
import jwt from 'jsonwebtoken';

export type ProtectMiddleWareErrorT =
  | { message: string; type: 'no-auth' }
  | { message: string; type: 'no-refresh' }
  | { message: string; type: 'request-access' }
  | { message: string; type: 'invalid-auth' }
  | { message: string; type: 'server-error' };

const ProtectMiddleWare = async (
  req: Request,
  res: Response<ProtectMiddleWareErrorT>,
  next: NextFunction
) => {
  try {
    const accessTokenSecret = config['JWT_ACCESS_TOKEN_SECRET'];
    const refreshTokenSecret = config['JWT_REFRESH_TOKEN_SECRET'];
    const REFRESH_TOKEN_COOKIE_NAME = config['REFRESH_TOKEN_COOKIE_NAME'];

    const authorizationHeader = req.headers['authorization'];
    const refreshToken = req.cookies[REFRESH_TOKEN_COOKIE_NAME];

    // 1. check both are present
    if (!authorizationHeader) {
      return res.status(401).json({
        message: 'Authorization header is required',
        type: 'no-auth',
      });
    }

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
  } catch (error) {
    console.error('ProtectMiddleWare error --->', (error as Error)?.message ?? error);
    return res.status(500).json({ message: 'INTERNAL_SERVER_ERROR', type: 'server-error' });
  }
};

export default ProtectMiddleWare;
