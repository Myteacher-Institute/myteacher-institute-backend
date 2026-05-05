import { Router } from "express";
import { handleSignupUser } from "../controllers/auth.controller.signup";



const authRoute: Router = Router()

authRoute.post("/signup", handleSignupUser)
export default authRoute