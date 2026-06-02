import { Request } from 'express';

import logger from '@/utils';
import { User } from '@/models';
import { sendVerificationEmail } from './email.service';
import { handleAuthenticateResT } from '@/types/auth.types';

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
