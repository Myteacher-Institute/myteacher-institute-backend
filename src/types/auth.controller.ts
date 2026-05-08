import { IUser } from '../models/user.model';

type handleAuthenticateErrorT = {
  errorOnInput: boolean;
  status: 'failed';
  message: string;
};

type handleAuthenticateSuccessResT = {
  status: 'success';
  instruction: 'give-code' | 'give-password';
  message: string;
};

type handleVerifyPasswordErrorT = {
  errorOnInput: 'email' | 'password' | boolean;
  status: 'failed';
  message: string;
};

type handleVerifyPasswordDefaultSuccessT = {
  status: 'success';
  isGiveCode: boolean;
  isTrusted: false;
  isCompleted: boolean;
  message: string;
};

type handleVerifyPasswordTrustedSuccessT = {
  status: 'success';
  isTrusted: true;
  message: string;
  access_code: string;
};

type handleVerifyOtpErrorT = {
  status: 'failed';
  message: string;
};

type handleVerifySuccesT = {
  status: 'success';
  message: string;
  authUser: IUser;
  accessToken: string;
};

export type handleVerifyOtpResT = handleVerifyOtpErrorT | handleVerifySuccesT;

export type handleVerifyPasswordResT =
  | handleVerifyPasswordErrorT
  | handleVerifyPasswordDefaultSuccessT
  | handleVerifyPasswordTrustedSuccessT;

type HandleGetAccessTokenSuccessT = {
  message: string;
  type: 'success';
  accessToken: string;
};

type HandleGetAccessTokenErrorT =
  | { message: string; type: 'no-refresh' }
  | { message: string; type: 'invalid-refresh' }
  | { message: string; type: 'server-error' };

export type HandleGetAccessTokenResponseT =
  | HandleGetAccessTokenSuccessT
  | HandleGetAccessTokenErrorT;

export type handleAuthenticateResT = handleAuthenticateErrorT | handleAuthenticateSuccessResT;

export type handleSendResetInstructionsResT =
  | { status: 'failed'; message: string }
  | { status: 'success'; message: string };
