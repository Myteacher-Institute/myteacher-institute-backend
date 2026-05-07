import { Router } from 'express';
import {
  handleAuthenticateUser,
  handleGetAccessToken,
  handleVerifyOtp,
  handleVerifyPassword,
} from '../controllers/auth.controller';
import ProtectMiddleWare from '../middleware/protect-route';

const authRoute: Router = Router();

authRoute.post('/initiate', handleAuthenticateUser);
authRoute.post('/verify-password', handleVerifyPassword);
authRoute.post('/verify-otp', handleVerifyOtp);
authRoute.get('/new-access-code', ProtectMiddleWare, handleGetAccessToken);

export default authRoute;
