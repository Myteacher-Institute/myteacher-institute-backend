import { Router } from "express";
import { handleAuthenticateUser, handleVerifyOtp, handleCheckUserExists, handleRegisterUser, handleResendOtp, handleSendResetInstructions, handleResetPasswordWithCode } from "../controllers/auth.controller";


const authRoute: Router = Router()

authRoute.post("/check-user", handleCheckUserExists)
authRoute.post("/register", handleRegisterUser)
authRoute.post("/login", handleAuthenticateUser)
authRoute.post("/verify-otp", handleVerifyOtp)
authRoute.post("/resend-otp", handleResendOtp)
authRoute.post("/send-reset-instructions", handleSendResetInstructions)
authRoute.post("/reset-password-with-code", handleResetPasswordWithCode)

export default authRoute