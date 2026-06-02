

import config from '../config/env';
import jwt from 'jsonwebtoken';
import { Request } from 'express';
import IPLocate from 'node-iplocate';
import { Resend } from 'resend';
import { handleVerifyPasswordResT } from '../types/controller/auth.types';

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

export const validateVerifyPasswordInput = (
  email: any,
  password: any
): true | handleVerifyPasswordResT => {
  if (typeof email !== 'string') {
    return {
      errorOnInput: 'email',
      status: 'failed',
      message: 'Email must be a string',
    };
  }

  if (!email) {
    return {
      errorOnInput: 'email',
      status: 'failed',
      message: 'Email is required',
    };
  }

  if (typeof password !== 'string') {
    return {
      errorOnInput: 'password',
      status: 'failed',
      message: 'Password must be a string',
    };
  }

  if (!password) {
    return {
      errorOnInput: 'password',
      status: 'failed',
      message: 'Password is required',
    };
  }

  if (password.length < 6) {
    return {
      errorOnInput: 'password',
      status: 'failed',
      message: 'Password must be at least 6 characters long',
    };
  }

  return true;
};

export const getHandleVerifyOtpSuccessMessage = (useCase: string): string => {
  if (useCase === 'new-account') {
    return 'Account verified successfully! Welcome aboard.';
  } else if (useCase === 'onboarded-account') {
    return 'Device verified successfully! You can now access your account.';
  }
  return 'Verification successful!';
};

export default logger;
