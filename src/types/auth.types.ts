import { IUser } from ".";

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

type handleVerifyOtpOnboardingSuccessT = {
  status: 'success';
  message: string;
  nextStep: 'onboarding';
  userId: string;
};

type handleVerifySuccessT = {
  status: 'success';
  message: string;
  authUser: IUser;
  accessToken: string;
};

type handleCompleteOnboardingSuccessT = {
  status: 'success';
  message: string;
  authUser: IUser;
  accessToken: string;
};

type handleCompleteOnboardingErrorT = {
  status: 'failed';
  message: string;
};

export type handleVerifyOtpResT = handleVerifyOtpErrorT | handleVerifyOtpOnboardingSuccessT | handleVerifySuccessT;

export type handleCompleteOnboardingResT = handleCompleteOnboardingSuccessT | handleCompleteOnboardingErrorT;

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

export type handleResetPasswordWithCodeResT = { status: 'failed' | 'success'; message: string };
