import { Router } from "express";
import { handleLogin, handleSignup, handleVerifyOtp } from "../controllers/auth.controller";


const authRoute: Router = Router()

authRoute.post("/signup", handleSignup)
authRoute.post("/verofy-otp", handleVerifyOtp)

export default authRoute