import { Request, Response } from 'express';

import {
  handleVerifyOtpResT,
  handleAuthenticateResT,
  handleVerifyPasswordResT,
  handleCompleteOnboardingResT,
  HandleGetAccessTokenResponseT,
  handleResetPasswordWithCodeResT,
  handleSendResetInstructionsResT,
  handleRegisterResT,
} from '../types/auth.types';

interface CheckUserExistsResponse {
  userExists: boolean;
}

import {
  verifyOtp,
  verifyPassword,
  getAccessToken,
  googleCallback,
  authenticateUser,
  completeOnboarding,
  sendResetInstructions,
  resetPasswordWithCode,
  checkUserExists,
  registerUser,
  resendOtp,
} from '../services';

export const handleCheckUserExists = async (
  req: Request<any, any, { email: string }>,
  res: Response<CheckUserExistsResponse>
) => {
  const { status, body } = await checkUserExists(req);
  return res.status(status).json(body);
};

export const handleAuthenticateUser = async (
  req: Request<any, any, { email: string, password: string }>,
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
  const { password, confirmPassword } = req.body || {};

  if (password !== confirmPassword) {
    return res.status(400).json({ status: 'failed', message: 'Passwords do not match' });
  }

  const { status, body } = await completeOnboarding(req);
  return res.status(status).json(body);
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

export const handleRegisterUser = async (
  req: Request<any, any, { email: string; password: string; name: string; phone: string }>,
  res: Response<handleRegisterResT>
) => {
  const { status, body } = await registerUser(req);
  return res.status(status).json(body);
};

export const handleResendOtp = async (
  req: Request<any, any, { email: string }>,
  res: Response<{ status: 'success' | 'failed'; message: string }>
) => {
  const { status, body } = await resendOtp(req);
  return res.status(status).json(body);
};
