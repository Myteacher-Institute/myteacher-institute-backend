

import config from '../config/env';
import jwt from 'jsonwebtoken';
import { Request } from 'express';
import IPLocate from 'node-iplocate';
import { Resend } from 'resend';

export const logger = {
  info: (message: string): void => console.log(`ℹ️  ${message}`),
  error: (message: string): void => console.error(`❌ ${message}`),
  success: (message: string): void => console.log(`✓ ${message}`),
  warn: (message: string): void => console.warn(`⚠️  ${message}`),
};

export const IPLocateClient = new IPLocate(process.env.IPLOCATE_API_KEY ?? '');

export const resend = new Resend(process.env.RESEND_API_KEY);

type generateJWT = {
  userId: string;
  sessionId: string;
  type: 'refresh' | 'access';
};

export const getClientIp = (req: Request): string => {
  const forwarded = req.headers['x-forwarded-for'];
  const ip =
    req.headers['cf-connecting-ip'] ||
    (typeof forwarded === 'string' ? forwarded.split(',')[0] : forwarded?.[0]) ||
    req.socket.remoteAddress ||
    '';

  return ip.toString();
};

export const generateJWT = (args: generateJWT): string | 'error' => {
  try {
    const { type, userId, sessionId } = args;

    if (type === 'access') {
      const secret = config['JWT_ACCESS_TOKEN_SECRET'];
      const token = jwt.sign({ userId, sessionId }, secret, { expiresIn: '15m' });
      return token;
    }

    const secret = config['JWT_REFRESH_TOKEN_SECRET'];
    const token = jwt.sign({ userId, sessionId }, secret, { expiresIn: '7d' });
    return token;
  } catch (error) {
    logger.error(`generateJWTCookie error -> ${(error as Error)?.message ?? error}`);
    return 'error';
  }
};

export default logger;
