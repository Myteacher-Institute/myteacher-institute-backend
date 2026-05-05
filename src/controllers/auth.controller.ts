import { Request, Response } from "express";
import { validateSignupPayload, signupReqBody, signupResponse } from "../services";
import User, { IUser } from "../models/user.model";
import Otp from "../models/otp.model";
import bcrypt from "bcryptjs";
import logger, { generateJWTCookie, resend } from "../utils";
import VerifyAccountEmail from "../templates/emails/verify-account-email";
import config from "../config/env";

const handleLogin = (req: Request, res: Response) => {
    try {

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Schedule for Delete [ALERT]
const handleSignup = async (req: Request<signupReqBody>, res: Response<signupResponse>) => {
    try {
        const validationError = validateSignupPayload(req?.body ?? {});
        if (validationError) {
            return res.status(400).json(validationError);
        }

        const findUser = await User.findOne({ email: req.body.email });
        if (findUser) {
            return res.status(409).json({
                isOnkey: true,
                errorOnkey: "email",
                message: "User with this email already exists",
                isSuccess: false
            });
        }

        const name = `${req.body.firstName} ${req.body.lastName}`

        const password = req.body.password

        const hashpassword = await bcrypt.hash(password, 10);

        const newUser = await User.create({
            email: req.body.email,
            name: name,
            password: hashpassword,
            isEmailVerified: false
        });

        // Generate OTP for email verification
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();



        const newOtp = await Otp.create({
            accountToVerifyId: newUser._id,
            otp: otpCode,
            expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
            isUsed: false
        });

        logger.info(`OTP generated for user ${newUser._id}: ${otpCode}`);


        const verifyAccountProps = {
            previewText: "Verify your account with your 6-digit code",
            logo_url: "https://raw.githubusercontent.com/lobehub/lobe-icons/refs/heads/master/packages/static-png/light/notion.png",
            username: newUser.name,
            code: otpCode
        }

        const { data, error } = await resend.emails.send({
            from: process.env.NO_REPLY_EMAIL ?? "Acme <onboarding@resend.dev>",
            to: newUser.email,
            subject: "Verify Your Account",
            react: VerifyAccountEmail(verifyAccountProps)
        });

        if (error) {
            logger.error(`Failed to send verification email to ${newUser.email}: ${error.message}`);
            return res.status(500).json({
                isOnkey: false,
                errorOnkey: "email",
                message: "Failed to send verification email. Please try again.",
                isSuccess: false
            });
        }

        logger.info(`Email sent successfully. Resend response data: ${JSON.stringify(data)}`);
        logger.info(`Email ID: ${data?.id}, Message ID: ${data?.id}`);

        logger.info(`Verification email sent successfully to ${newUser.email} with OTP: ${otpCode}`);
        logger.info(`Email details: from=${process.env.NO_REPLY_EMAIL ?? "Acme <onboarding@resend.dev>"}, to=${newUser.email}, subject="Verify Your Account"`);
        logger.info(`User created successfully: ID=${newUser._id}, email=${newUser.email}, username=${newUser.name}`);

        return res.status(201).json({
            authUser: newUser,
            isSuccess: true,
            message: "Account created successfully. Please check your email for verification code.",
            showOtpInput: true
        });

    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({
            isOnkey: false,
            errorOnkey: "email",
            message: 'Internal server error',
            isSuccess: false
        });
    }
};

type handleVerifyOtpErrorT = {
    status: "failed",
    message: string,
}

type handleVerifySuccesT = {
    status: "success",
    message: string,
    authUser: IUser,
    accessToken: string
}

type handleVerifyOtpResT = handleVerifyOtpErrorT | handleVerifySuccesT

const handleVerifyOtp = async (req: Request<any, any, { otp: string }>, res: Response<handleVerifyOtpResT>) => {
    try {

        const { otp } = req.body || {}

        // Validate OTP
        if (!otp || typeof otp !== 'string') {
            return res.status(400).json({
                message: 'OTP is required and must be a string',
                status: "failed"
            });
        }

        if (otp.length !== 6) {
            return res.status(400).json({
                message: 'OTP must be exactly 6 digits',
                status: "failed"
            });
        }

        const findOtp = await Otp.findOne({
            otp
        })

        if (!findOtp) {
            return res.status(400).json({
                message: 'Invalid or expired OTP code',
                status: "failed"
            });
        }

        const findUser = await User.findByIdAndUpdate(findOtp.accountToVerifyId, {
            isEmailVerified: true
        }, {
            returnDocument: "after"
        })
        if (!findUser) {
            return res.status(400).json({
                message: 'Invalid or expired OTP code',
                status: "failed"
            });
        }

        const userId = findUser._id.toString()

        const refreshToken = await generateJWTCookie({
            type: "refresh",
            userId,
        })

        const accessToken = await generateJWTCookie({
            type: "access",
            userId,
        })

        if (refreshToken === "error" || accessToken === "error") {
            return res.status(500).json({
                message: 'Something unexpected happened, try again',
                status: "failed"
            });
        }

        const REFRESH_TOKEN_COOKIE_NAME = config["REFRESH_TOKEN_COOKIE_NAME"]

        res.cookie(REFRESH_TOKEN_COOKIE_NAME, refreshToken)

        return res.status(200).json({
            message: "Account Confirmation Successfull.",
            authUser: findUser,
            status: "success",
            accessToken,
        })

    } catch (error) {
        console.error('Error on handleVerifyOtp error --->', (error as Error)?.message ?? error);
        res.status(500).json({ message: 'SERVER_ERROR', status: "failed" });
    }
};

export { handleLogin, handleSignup, handleVerifyOtp };