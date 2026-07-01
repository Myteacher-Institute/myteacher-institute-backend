import { Router } from "express";
import { handleAddAdmin, handleAdminLogin, handleVerifyAdminOtp, handleResendAdminOtp, handleSendAdminResetCode, handleResetAdminPassword } from "../controllers/admin.controller";
import {ProtectMiddleWare} from "../middleware/protect-route";
import { isAdmin } from "../middleware/is-admin";

const router: Router = Router();

router.post("/login", handleAdminLogin);
router.post("/add-admin", /*ProtectMiddleWare, isAdmin,*/ handleAddAdmin);
router.post('/verify-otp', handleVerifyAdminOtp);
router.post('/resend-otp', handleResendAdminOtp);
router.post('/send-reset-code', handleSendAdminResetCode);
router.post('/reset-password', handleResetAdminPassword);

export default router;
