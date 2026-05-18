import { Request, Response } from 'express';

import {
  handleAuthenticateResT,
  HandleGetAccessTokenResponseT,
  handleResetPasswordWithCodeResT,
  handleSendResetInstructionsResT,
  handleVerifyOtpResT,
  handleVerifyPasswordResT,
} from '../types/controller/auth.types';

import {
  authenticateUser,
  verifyPassword,
  verifyOtp,
  getAccessToken,
  sendResetInstructions,
  resetPasswordWithCode,
} from '../services';

export const handleAuthenticateUser = async (
  req: Request<any, any, { email: string }>,
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
  req: Request<any, any, { otp: string }>,
  res: Response<handleVerifyOtpResT>
) => {
  const { status, body } = await verifyOtp(req);
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
