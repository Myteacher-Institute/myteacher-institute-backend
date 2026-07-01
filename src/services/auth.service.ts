import { Request } from 'express';

import logger from '../utils';
import User  from '../models/user.model';
import { sendVerificationEmail } from './email.service';
import { handleAuthenticateResT, handleRegisterResT } from '../types/auth.types';
import bcrypt from 'bcryptjs';

export const checkUserExists = async (
  req: Request<any, any, { email: string }>
): Promise<{ status: number; body: { userExists: boolean } }> => {
  try {
    const { email } = req.body || {};

    if (!email) {
      return { status: 400, body: { userExists: false } };
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      return { status: 400, body: { userExists: false } };
    }

    const findUser = await User.findOne({ email });

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

    if (!email) {
      return { status: 400, body: { errorOnInput: true, status: 'failed', message: 'Email is required' } };
    }

    if (!password) {
      return { status: 400, body: { errorOnInput: true, status: 'failed', message: 'Password is required' } };
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      return { status: 400, body: { errorOnInput: true, status: 'failed', message: 'Invalid email format' } };
    }

    const findUser = await User.findOne({ email });

    if (!findUser) {
      return { status: 401, body: { errorOnInput: true, status: 'failed', message: 'Invalid credentials' } };
    }

    if (!findUser.password) {
      return { status: 400, body: { errorOnInput: true, status: 'failed', message: 'Please complete your account setup first' } };
    }

    const isPasswordValid = await bcrypt.compare(password, findUser.password);

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

    if (!email) {
      return { status: 400, body: { status: 'failed', message: 'Email is required', errorOnInput: true } };
    }

    if (!password) {
      return { status: 400, body: { status: 'failed', message: 'Password is required', errorOnInput: true } };
    }

    if (!name) {
      return { status: 400, body: { status: 'failed', message: 'Name is required', errorOnInput: true } };
    }

    if (!phone) {
      return { status: 400, body: { status: 'failed', message: 'Phone Number is required', errorOnInput: true } };
    }

    if (password.length < 6) {
      return { status: 400, body: { status: 'failed', message: 'Password must be at least 6 characters', errorOnInput: true } };
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      return { status: 400, body: { status: 'failed', message: 'Invalid email format', errorOnInput: true } };
    }

    const phoneRegex = /^[0-9]{10}$/;
    if (!phoneRegex.test(phone)) {
      return { status: 400, body: { status: 'failed', message: 'Invalid phone number format', errorOnInput: true } };
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return { status: 409, body: { status: 'failed', message: 'User with this email already exists', errorOnInput: true } };
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      email,
      password: hashedPassword,
      name,
      phone,
      isEmailVerified: false,
      hasOnboarded: false,
      role: 'user',
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
