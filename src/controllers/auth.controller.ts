import { Request, Response } from 'express';

import {
  handleVerifyOtpResT,
  handleAuthenticateResT,
  handleVerifyPasswordResT,
  handleCompleteOnboardingResT,
  HandleGetAccessTokenResponseT,
  handleResetPasswordWithCodeResT,
  handleSendResetInstructionsResT,
} from '@/types/auth.types';

import {
  verifyOtp,
  verifyPassword,
  getAccessToken,
  googleCallback,
  authenticateUser,
  completeOnboarding,
  sendResetInstructions,
  resetPasswordWithCode,
} from '@/services';
import { generateJWT, getClientIp } from '@/utils';
import { generateSession } from '@/services/session.service';

export const handleAuthenticateUser = async (
  req: Request<any, any, { email: string, role: "user" | "instructor" }>,
  res: Response<handleAuthenticateResT>
) => {
  const { status, body } = await authenticateUser(req);
  return res.status(status).json(body);
};

export const handleVerifyPassword = async (
  req: Request<any, any, { password?: string; email?: string }>,
  res: Response<handleVerifyPasswordResT>
) => {
  const { status, body, cookie } = await verifyPassword(req);

  if (cookie) {
    res.cookie(cookie.name, cookie.value, {
      maxAge: 30 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'none',
    });
  }

  return res.status(status).json(body);
};

export const handleVerifyOtp = async (
  req: Request<any, any, { otp: string; email?: string }>,
  res: Response<handleVerifyOtpResT>
) => {
  const { status, body } = await verifyOtp(req);
  return res.status(status).json(body);
};

export const handleCompleteOnboarding = async (
  req: Request<any, any, { userId: string; name: string; password: string; confirmPassword: string }>,
  res: Response<handleCompleteOnboardingResT>
) => {
  const { userId, name, password, confirmPassword } = req.body || {};

  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ status: 'failed', message: 'User ID is required' });
  }

  if (!name || typeof name !== 'string') {
    return res.status(400).json({ status: 'failed', message: 'Name is required' });
  }

  if (!password || typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ status: 'failed', message: 'Password must be at least 6 characters long' });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ status: 'failed', message: 'Passwords do not match' });
  }

  const result = await completeOnboarding({ userId, name, password });

  if (!result.isSuccessful) {
    return res.status(400).json({ status: 'failed', message: result.reason });
  }

  const user = result.user;
  if (!user) {
    return res.status(500).json({ status: 'failed', message: 'Unable to load user after onboarding' });
  }

  const ip = getClientIp(req);
  const userAgent = req.get('User-Agent') || '';
  const userIdString = String(user._id);

  const sessionRes = await generateSession({ ip, userAgent, userId: userIdString });
  if (!sessionRes.isSuccessful) {
    return res.status(400).json({ status: 'failed', message: sessionRes.reason });
  }

  const accessToken = generateJWT({ sessionId: sessionRes.sessionId, type: 'access', userId: userIdString });

  return res.status(200).json({
    status: 'success',
    message: 'Onboarding completed successfully',
    authUser: user,
    accessToken: accessToken as string,
  });
};

export const handleGetAccessToken = (
  req: Request,
  res: Response<HandleGetAccessTokenResponseT>
) => {
  const { status, body } = getAccessToken(req);
  return res.status(status).json(body);
};

export const handleSendResetInstructions = async (
  req: Request<any, any, { email?: string }>,
  res: Response<handleSendResetInstructionsResT>
) => {
  const { status, body } = await sendResetInstructions(req);
  return res.status(status).json(body);
};

export const handleResetPasswordWithCode = async (
  req: Request<any, any, { code?: string; password?: string; confirmPassword?: string; logoutAllDevices?: boolean }>,
  res: Response<handleResetPasswordWithCodeResT>
) => {
  const { status, body } = await resetPasswordWithCode(req);
  return res.status(status).json(body);
};

export const handleGoogleCallback = async (req: Request<any, any, any, any>, res: Response) => {
  await googleCallback(req, res);
};
