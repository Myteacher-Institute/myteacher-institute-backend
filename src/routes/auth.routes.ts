import { Router } from 'express';
import {
  handleAuthenticateUser,
  handleGetAccessToken,
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

export default authRoute;
