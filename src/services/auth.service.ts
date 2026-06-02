import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Request, Response } from 'express';

import { User, Otp, Session } from '../models';
import config from '../config/env';
import logger, { generateJWT, getClientIp } from '../utils';
import { generateSession } from '../utils/create-session';
import { sendVerificationEmail } from './send-email';
import { validateVerifyPasswordInput } from '../utils';

import {
  handleAuthenticateResT,
  HandleGetAccessTokenResponseT,
  handleVerifyPasswordResT,
} from '../types/auth.types';

export const authenticateUser = async (
  req: Request<any, any, { email: string, role: "user" | "instructor" }>
): Promise<{ status: number; body: handleAuthenticateResT }> => {
  try {
    const { email, role } = req.body || {};

    if (!email) {
      return { status: 400, body: { errorOnInput: true, status: 'failed', message: 'Email is required' } };
    }

    if (!role || !['user', 'instructor'].includes(role)) {
      return { status: 400, body: { errorOnInput: true, status: 'failed', message: 'Valid role is required (user or instructor)' } };
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      return { status: 400, body: { errorOnInput: true, status: 'failed', message: 'Invalid email format' } };
    }

    const findUser = await User.findOne({ email });

    if (findUser) {
      if (findUser.hasOnboarded) {
        return {
          status: 200,
          body: { status: 'success', instruction: 'give-password', message: 'User onboarded, password required' },
        };
      }

      const emailStatus = await sendVerificationEmail(findUser._id.toString(), findUser.email, 'new-account');

      if (emailStatus === 'rate-limited') {
        return { status: 429, body: { errorOnInput: false, status: 'failed', message: 'Too many attempts. Please wait 15 minutes to request another code.' } };
      }

      if (emailStatus === 'error') {
        return { status: 500, body: { errorOnInput: false, status: 'failed', message: 'Failed to send verification email. Please try again.' } };
      }

      return {
        status: 200,
        body: { status: 'success', instruction: 'give-code', message: 'An OTP code has been sent to your email. Please verify to continue.' },
      };
    }

    const newUser = await User.create({ email, role });
    const emailStatus = await sendVerificationEmail(newUser._id.toString(), newUser.email, 'new-account');

    if (emailStatus === 'rate-limited') {
      return { status: 429, body: { errorOnInput: false, status: 'failed', message: 'Too many attempts. Please wait 15 minutes to request another code.' } };
    }

    if (emailStatus === 'error') {
      return { status: 500, body: { errorOnInput: false, status: 'failed', message: 'Failed to send verification email. Please try again.' } };
    }

    return {
      status: 200,
      body: { status: 'success', instruction: 'give-code', message: 'An OTP code has been sent to your email. Please verify to continue.' },
    };
  } catch (error) {
    logger.error(`Error on @authenticateUser: ${(error as Error)?.message ?? error}`);
    return { status: 500, body: { errorOnInput: false, status: 'failed', message: 'Internal server error' } };
  }
};


export const verifyPassword = async (
  req: Request<any, any, { password?: string; email?: string }>
): Promise<{ status: number; body: handleVerifyPasswordResT; cookie?: { name: string; value: string } }> => {
  try {
    const { email, password } = req.body;

    const validationResult = validateVerifyPasswordInput(email, password);
    if (validationResult !== true) {
      return { status: 400, body: validationResult };
    }

    const findUser = await User.findOne({ email });

    if (!findUser || !findUser.hasOnboarded) {
      return { status: 404, body: { errorOnInput: false, status: 'failed', message: 'Wrong endpoint. Please contact support.' } };
    }

    const isPasswordCorrect = await bcrypt.compare(password!, findUser.password);

    if (!isPasswordCorrect) {
      return { status: 400, body: { errorOnInput: 'password', status: 'failed', message: 'The password you entered is incorrect. Please try again.' } };
    }

    const userIp = getClientIp(req);
    const userAgent = req.get('User-Agent') || '';

    const trustedSession = await Session.findOne({
      userId: findUser._id,
      ip: userIp,
      userAgent,
      isRevoked: false,
    });

    if (trustedSession) {
      const sessionResult = await generateSession({ ip: userIp, userAgent, userId: findUser._id.toString() });

      if (!sessionResult.isSuccessful) {
        return { status: 400, body: { errorOnInput: false, status: 'failed', message: sessionResult.reason } };
      }

      const access_code = generateJWT({ sessionId: sessionResult.sessionId, type: 'access', userId: findUser._id.toString() });

      return {
        status: 200,
        body: { status: 'success', isTrusted: true, message: 'Welcome back! You have successfully logged in to your account.', access_code: access_code as string },
        cookie: { name: config['REFRESH_TOKEN_COOKIE_NAME'], value: sessionResult.token },
      };
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    await Otp.create({
      accountToVerifyId: findUser._id,
      otp: otpCode,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      isUsed: false,
      useCase: 'onboarded-account',
    });

    return {
      status: 200,
      body: { status: 'success', isTrusted: false, isGiveCode: true, isCompleted: false, message: 'New device detected. Please verify with the code sent to your email.' },
    };
  } catch (error) {
    logger.error(`Error on @verifyPassword: ${(error as Error)?.message ?? error}`);
    return { status: 500, body: { errorOnInput: false, status: 'failed', message: 'Internal server error' } };
  }
};

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

type GoogleCallbackQuery = {
  iss: string;
  code: string;
  scope: string;
  authuser: string;
  prompt: string;
  state?: 'instructor' | 'user';
};

type GoogleTokenResponse = {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
  id_token: string;
  error?: string;
  error_description?: string;
};

type GoogleUserInfo = {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  given_name: string;
  family_name: string;
  picture: string;
};

const FRONTEND_OAUTH_URL = `${process.env.FRONTEND_BASE_URL}/oauth/google`;

const VALID_ROLES = ['user', 'instructor'] as const;
type OAuthRole = (typeof VALID_ROLES)[number];

function getRoleFromState(state: unknown): OAuthRole {
  if (!state || typeof state !== 'string') return 'user';
  const candidate = state as string;
  if ((VALID_ROLES as readonly string[]).includes(candidate)) {
    return candidate as OAuthRole;
  }
  return 'user';
}

export const googleCallback = async (
  req: Request<any, any, any, GoogleCallbackQuery>,
  res: Response
): Promise<void> => {
  try {
    const { code, iss, scope, authuser, prompt, state } = req.query;

    const role = getRoleFromState(state);

    if (
      !code || typeof code !== 'string' ||
      !iss || typeof iss !== 'string' ||
      !scope || typeof scope !== 'string' ||
      !authuser || typeof authuser !== 'string' ||
      !prompt || typeof prompt !== 'string'
    ) {
      res.redirect(`${FRONTEND_OAUTH_URL}?status=invalid_params`);
      return;
    }

    const redirect_uri = `${process.env.BACKEND_BASE_URL}/api/auth/google/callback`;

    const params = new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? '',
      client_secret: process.env.GOOGLE_SECRET ?? '',
      redirect_uri,
      grant_type: 'authorization_code',
    });

    const tokenDataRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const tokenData: GoogleTokenResponse = await tokenDataRes.json();

    if (tokenData.error) {
      res.redirect(`${FRONTEND_OAUTH_URL}?status=token_error`);
      return;
    }

    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    const userInfo: GoogleUserInfo = await userInfoResponse.json();

    const ip = getClientIp(req);
    const userAgent = req.headers['user-agent'] ?? '';

    const userName = [userInfo.given_name, userInfo.family_name].filter(Boolean).join(' ') || userInfo.name || '';

    let user = await User.findOne({ email: userInfo.email });

    if (!user) {
      if (!userName) {
        res.redirect(`${FRONTEND_OAUTH_URL}?status=incomplete_info`);
        return;
      }

      user = await User.create({
        name: userName,
        email: userInfo.email,
        role,
        isEmailVerified: userInfo.verified_email,
      });
    }

    const sessionResult = await generateSession({
      ip,
      userAgent,
      userId: user._id.toString(),
    });

    if (!sessionResult.isSuccessful) {
      res.redirect(`${FRONTEND_OAUTH_URL}?status=session_failed`);
      return;
    }

    res.cookie(config['REFRESH_TOKEN_COOKIE_NAME'], sessionResult.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    res.redirect(`${FRONTEND_OAUTH_URL}?status=success`);
  } catch (error) {
    logger.error(`Error on @googleCallback: ${(error as Error)?.message ?? error}`);
    res.redirect(`${FRONTEND_OAUTH_URL}?status=server_error`);
  }
};
