import { Request } from 'express';

import logger, { sanitizeString } from '../utils';
import User  from '../models/user.model';
import { sendVerificationEmail } from './email.service';
import { handleAuthenticateResT, handleRegisterResT } from '../types/auth.types';
import bcrypt from 'bcryptjs';
import { createNotification } from './notification.service';

export const checkUserExists = async (
  req: Request<any, any, { email: string }>
): Promise<{ status: number; body: { userExists: boolean } }> => {
  try {
    const { email } = req.body || {};

    // #10/#22 sanitize — reject non-string (MongoDB operator injection)
    const safeEmail = sanitizeString(email);
    if (!safeEmail) {
      return { status: 400, body: { userExists: false } };
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(safeEmail)) {
      return { status: 400, body: { userExists: false } };
    }

    const findUser = await User.findOne({ email: safeEmail });

    return {
      status: 200,
      body: { userExists: !!findUser },
    };
  } catch (error) {
    logger.error(`Error on @checkUserExists: ${(error as Error)?.message ?? error}`);
    return { status: 500, body: { userExists: false } };
  }
};

export const authenticateUser = async (
  req: Request<any, any, { email: string, password: string }>
): Promise<{ status: number; body: handleAuthenticateResT }> => {
  try {
    const { email, password } = req.body || {};

    // #10/#22 sanitize
    const safeEmail = sanitizeString(email);
    const safePassword = sanitizeString(password);

    if (!safeEmail) {
      return { status: 400, body: { errorOnInput: true, status: 'failed', message: 'Email is required' } };
    }
    if (!safePassword) {
      return { status: 400, body: { errorOnInput: true, status: 'failed', message: 'Password is required' } };
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(safeEmail)) {
      return { status: 400, body: { errorOnInput: true, status: 'failed', message: 'Invalid email format' } };
    }

    const findUser = await User.findOne({ email: safeEmail });

    if (!findUser) {
      return { status: 401, body: { errorOnInput: true, status: 'failed', message: 'Invalid credentials' } };
    }

    if (!findUser.password) {
      return { status: 400, body: { errorOnInput: true, status: 'failed', message: 'Please complete your account setup first' } };
    }

    const isPasswordValid = await bcrypt.compare(safePassword, findUser.password);

    if (!isPasswordValid) {
      return { status: 401, body: { errorOnInput: true, status: 'failed', message: 'Invalid credentials' } };
    }

    const emailStatus = await sendVerificationEmail(findUser._id.toString(), findUser.email, 'login');

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

export const resendOtp = async (
  req: Request<any, any, { email: string }>
): Promise<{ status: number; body: { status: 'success' | 'failed'; message: string } }> => {
  try {
    const { email } = req.body || {};

    if (!email) {
      return { status: 400, body: { status: 'failed', message: 'Email is required' } };
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      return { status: 400, body: { status: 'failed', message: 'Invalid email format' } };
    }

    const findUser = await User.findOne({ email });

    if (!findUser) {
      return { status: 404, body: { status: 'failed', message: 'User not found' } };
    }

    const useCase = findUser.hasOnboarded ? 'login' : 'new-account';
    const emailStatus = await sendVerificationEmail(findUser._id.toString(), findUser.email, useCase);

    if (emailStatus === 'rate-limited') {
      return { status: 429, body: { status: 'failed', message: 'Too many attempts. Please wait 15 minutes to request another code.' } };
    }

    if (emailStatus === 'error') {
      return { status: 500, body: { status: 'failed', message: 'Failed to send verification email. Please try again.' } };
    }

    return {
      status: 200,
      body: { status: 'success', message: 'OTP code has been resent to your email.' },
    };
  } catch (error) {
    logger.error(`Error on @resendOtp: ${(error as Error)?.message ?? error}`);
    return { status: 500, body: { status: 'failed', message: 'Internal server error' } };
  }
};

export const registerUser = async (
  req: Request<any, any, { email: string; password: string; name: string; phone: string }>
): Promise<{ status: number; body: handleRegisterResT }> => {
  try {
    const { email, password, name, phone } = req.body || {};

    // #10/#22 sanitize all string inputs
    const safeEmail = sanitizeString(email);
    const safePassword = sanitizeString(password);
    const safeName = sanitizeString(name);
    const safePhone = sanitizeString(phone);

    if (!safeEmail) {
      return { status: 400, body: { status: 'failed', message: 'Email is required', errorOnInput: true } };
    }
    if (!safePassword) {
      return { status: 400, body: { status: 'failed', message: 'Password is required', errorOnInput: true } };
    }
    if (!safeName) {
      return { status: 400, body: { status: 'failed', message: 'Name is required', errorOnInput: true } };
    }
    if (!safePhone) {
      return { status: 400, body: { status: 'failed', message: 'Phone Number is required', errorOnInput: true } };
    }

    const passwordReg = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordReg.test(safePassword)) {
      return { status: 400, body: { status: 'failed', message: 'Password must be at least 8 characters and contain at least one uppercase letter, one lowercase letter, one number and one special character', errorOnInput: true } };
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(safeEmail)) {
      return { status: 400, body: { status: 'failed', message: 'Invalid email format', errorOnInput: true } };
    }

    // #15 phone — accept 7-15 digits, optional leading +, covers international numbers
    const phoneRegex = /^\+?[0-9]{7,15}$/;
    if (!phoneRegex.test(safePhone)) {
      return { status: 400, body: { status: 'failed', message: 'Invalid phone number format', errorOnInput: true } };
    }

    const existingUser = await User.findOne({ email: safeEmail });
    if (existingUser) {
      return { status: 409, body: { status: 'failed', message: 'User with this email already exists', errorOnInput: true } };
    }

    const hashedPassword = await bcrypt.hash(safePassword, 10);

    const newUser = await User.create({
      email: safeEmail,
      password: hashedPassword,
      name: safeName,
      phone: safePhone,
      isEmailVerified: false,
      hasOnboarded: false,
      role: 'user', // #18 role always hardcoded — never taken from request body
    });

    const emailStatus = await sendVerificationEmail(newUser._id.toString(), newUser.email, 'new-account');

    if (emailStatus === 'rate-limited') {
      return { status: 429, body: { status: 'failed', message: 'Too many attempts. Please wait 15 minutes to request another code.' } };
    }

    if (emailStatus === 'error') {
      return { status: 500, body: { status: 'failed', message: 'Failed to send verification email. Please try again.' } };
    }

    return {
      status: 201,
      body: { status: 'success', instruction: 'give-code', message: 'Registration successful. An OTP code has been sent to your email.', userId: newUser._id.toString() },
    };
  } catch (error) {
    logger.error(`Error on @registerUser: ${(error as Error)?.message ?? error}`);
    return { status: 500, body: { status: 'failed', message: 'Internal server error' } };
  }
};
