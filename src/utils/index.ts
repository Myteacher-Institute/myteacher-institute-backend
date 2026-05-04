// Utility functions for the application
// Add helper functions, validators, formatters, etc. here

import { Resend } from "resend";
import config from "../config/env";
import jwt from "jsonwebtoken";

export const logger = {
    info: (message: string): void => console.log(`ℹ️  ${message}`),
    error: (message: string): void => console.error(`❌ ${message}`),
    success: (message: string): void => console.log(`✓ ${message}`),
    warn: (message: string): void => console.warn(`⚠️  ${message}`),
};

export const resend = new Resend(process.env.RESEND_API_KEY);


type generateJWTCookieT = {
    userId: string,
    type: "refresh" | "access"
}

export const generateJWTCookie = (args: generateJWTCookieT): string | "error" => {
    try {
        const { type, userId } = args

        if (type === "access") {
            const secret = config["JWT_ACCESS_TOKEN_SECRET"]
            const token = jwt.sign({ userId }, secret, { expiresIn: '15m' });
            return token;
        }

        const secret = config["JWT_REFRESH_TOKEN_SECRET"]
        const token = jwt.sign({ userId }, secret, { expiresIn: '7d' });
        return token;


    } catch (error) {
        logger.error(`generateJWTCookie error -> ${(error as Error)?.message ?? error}`);
        return "error"
    }
}





export default logger;
