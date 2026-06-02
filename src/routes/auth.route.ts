import { Router } from 'express';
import ProtectMiddleWare from '@/middleware/protect-route';

import {
  handleVerifyOtp,
  handleGetAccessToken,
  handleGoogleCallback,
  handleVerifyPassword,
  handleAuthenticateUser,
  handleCompleteOnboarding,
  handleResetPasswordWithCode,
  handleSendResetInstructions,
} from '@/controllers/auth.controller';

const authRoute: Router = Router();

authRoute.post('/initiate', handleAuthenticateUser);
authRoute.post('/verify-otp', handleVerifyOtp);
authRoute.post('/complete-onboarding', handleCompleteOnboarding);
authRoute.post('/verify-password', handleVerifyPassword);
authRoute.get('/new-access-code', ProtectMiddleWare, handleGetAccessToken);
authRoute.post('/request-reset-account-instructions', handleSendResetInstructions);
authRoute.post('/reset-password-with-code', handleResetPasswordWithCode);
authRoute.get('/google/callback', handleGoogleCallback);

export default authRoute;
