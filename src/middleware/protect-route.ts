import { Request, Response, NextFunction } from "express";
import config from "../config/env";
import jwt from 'jsonwebtoken'



type ProtectMiddleWareErrorT = {
    type: "no-header" | "no-auth" | "server-error" | "invalid-auth",
    message: string
}




const ProtectMiddleWare = (req: Request, res: Response<ProtectMiddleWareErrorT>, next: NextFunction) => {
    try {
        const headers = req.headers

        if (!headers || Object.keys(headers).length === 0) {
            return res.status(400).json({
                message: 'No headers provided',
                type: "no-header"
            });
        }

        const authorizationHeaders = headers["authorization"]

        if (!authorizationHeaders) {
            return res.status(401).json({
                message: 'Authorization header is required',
                type: "no-auth"
            });
        }

        const token = authorizationHeaders.split(" ")[1]

        if (!token) {
            return res.status(401).json({
                message: 'Invalid authorization format',
                type: "no-auth"
            });
        }

        const REFRESH_TOKEN_COOKIE_NAME = config["REFRESH_TOKEN_COOKIE_NAME"]

        const refreshToken = req.cookies[REFRESH_TOKEN_COOKIE_NAME]

        const refreshTokenSecret = config["JWT_REFRESH_TOKEN_SECRET"]
        const accessTokenSecret = config["JWT_ACCESS_TOKEN_SECRET"]


        try {
            const decoded = jwt.verify(token, accessTokenSecret) as {
                userId: string,
            };


            req.userId = decoded.userId;
            return next();
        } catch (error) {
            if ((error as Error)?.name === 'TokenExpiredError' || (error as Error)?.name === 'JsonWebTokenError') {
                console.error('Access token verify failed error --->', (error as Error)?.message ?? error);

            } else {
                console.error('Access token verify failed error  --->', (error as Error)?.message ?? error);
                // Try to verify refresh token with refresh token secret
                try {
                    const refreshDecoded = jwt.verify(refreshToken, refreshTokenSecret) as {
                        userId: string,
                    };

                    // Refresh token is valid, generate new access token
                    const newAccessToken = jwt.sign(
                        { userId: refreshDecoded.userId },
                        accessTokenSecret,
                        { expiresIn: '15m' }
                    );

                    // Set new access token in authorization header
                    req.userId = refreshDecoded.userId
                    res.setHeader('Authorization', `Bearer ${newAccessToken}`);
                    return next();

                } catch (refreshError) {
                    console.error('Refresh token verify failed error  --->', (refreshError as Error)?.message ?? refreshError);
                    res.status(401).json({ message: 'Invalid auth', type: "invalid-auth" });
                }
            }
        }

    } catch (error) {
        console.error('ProtectMiddleWare error --->', (error as Error)?.message ?? error);
        res.status(500).json({ message: 'INTERNAL_SERVER_ERRROR', type: "server-error" });
    }
};

export { ProtectMiddleWare };