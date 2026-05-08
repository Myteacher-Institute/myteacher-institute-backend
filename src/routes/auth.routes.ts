import { Router } from 'express';
import {
  handleAuthenticateUser,
  handleGetAccessToken,
  handleResetPasswordWithCode,
  handleSendResetInstructions,
  handleVerifyOtp,
  handleVerifyPassword,
} from '../controllers/auth.controller';
import ProtectMiddleWare from '../middleware/protect-route';

const authRoute: Router = Router();

authRoute.post('/initiate', handleAuthenticateUser);
authRoute.post('/verify-password', handleVerifyPassword);
authRoute.post('/verify-otp', handleVerifyOtp);
authRoute.get('/new-access-code', ProtectMiddleWare, handleGetAccessToken);
authRoute.post('/request-reset-account-instructions', handleSendResetInstructions);
authRoute.post('/reset-password-with-code', handleResetPasswordWithCode);

export default authRoute;
