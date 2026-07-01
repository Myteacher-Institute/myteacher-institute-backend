import { 
    ResetPasswordReqBody, 
    ResetPasswordResT, 
    SendResetPasswordCodeReqBody, 
    SendResetPasswordCodeResT 
} from "../types";
import { Request, Response } from "express";
import { 
        sendResetPasswordCode, 
        resetPassword, 
        resendResetPassword
    } from "../services";


const handleSendResetPasswordCode = async (req: Request<SendResetPasswordCodeReqBody>, res: Response<SendResetPasswordCodeResT>) => {
    try {
        const { email } = req.body;
        const result = await sendResetPasswordCode(email);

        if (!result.success) {
            return res.status(result.message?.includes("required") ? 400 : result.message?.includes("not found") ? 404 : 500).json({
                status: "failed",
                message: result.message || "An error occurred"
            });
        }

        return res.status(200).json({
            status: "success",
            message: result.message || "Password reset code sent successfully"
        });

    } catch (error) {
        console.error('Send reset password code error --->', (error as Error)?.message ?? error);
        res.status(500).json({
            status: "failed",
            message: "Internal server error"
        });
    }
};

const handleResetPassword = async (req: Request<ResetPasswordReqBody>, res: Response<ResetPasswordResT>) => {
    try {
        const { code, password } = req.body;
        const result = await resetPassword(code, password);

        if (!result.success) {
            return res.status(result.message?.includes("required") ? 400 : 404).json({
                status: "failed",
                message: result.message || "An error occurred"
            });
        }

        return res.status(200).json({
            status: "success",
            message: result.message || "Password reset successfully"
        });

    } catch (error) {
        console.error('Reset password error --->', (error as Error)?.message ?? error);
        res.status(500).json({
            status: "failed",
            message: "Internal server error"
        });
    }
};

const handleResendResetPassword = async (req: Request, res: Response<SendResetPasswordCodeResT>) => {
    try {
        const { email } = req.body;
        const result = await resendResetPassword(email);

        if (!result.success) {
            return res.status(result.message?.includes("required") ? 400 : result.message?.includes("not found") ? 404 : 500).json({
                status: "failed",
                message: result.message || "An error occurred"
            });
        }

        return res.status(200).json({
            status: "success",
            message: result.message || "Reset code sent successfully"
        });

    } catch (error) {
        console.error('Resend reset code error --->', (error as Error)?.message ?? error);
        res.status(500).json({
            status: "failed",
            message: "Internal server error"
        });
    }
};

export {
    handleSendResetPasswordCode,
    handleResetPassword,
    handleResendResetPassword
};