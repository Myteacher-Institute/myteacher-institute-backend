import { Request, Response } from 'express';

import { User } from '@/models';
import config from '@/config/env';
import logger, { getClientIp } from '@/utils';
import { generateSession } from '@/utils/create-session';

type GoogleCallbackQuery = {
    iss: string;
    code: string;
    scope: string;
    authuser: string;
    prompt: string;
    state?: 'instructor' | 'user';
};

type GoogleTokenResponse = {
    access_token: string;
    expires_in: number;
    scope: string;
    token_type: string;
    id_token: string;
    error?: string;
    error_description?: string;
};

type GoogleUserInfo = {
    id: string;
    email: string;
    verified_email: boolean;
    name: string;
    given_name: string;
    family_name: string;
    picture: string;
};

const FRONTEND_OAUTH_URL = `${process.env.FRONTEND_BASE_URL}/oauth/google`;

const VALID_ROLES = ['user', 'instructor'] as const;
type OAuthRole = (typeof VALID_ROLES)[number];

function getRoleFromState(state: unknown): OAuthRole {
    if (!state || typeof state !== 'string') return 'user';
    const candidate = state as string;
    if ((VALID_ROLES as readonly string[]).includes(candidate)) {
        return candidate as OAuthRole;
    }
    return 'user';
}

export const googleCallback = async (
    req: Request<any, any, any, GoogleCallbackQuery>,
    res: Response
): Promise<void> => {
    try {
        const { code, iss, scope, authuser, prompt, state } = req.query;

        const role = getRoleFromState(state);

        if (
            !code || typeof code !== 'string' ||
            !iss || typeof iss !== 'string' ||
            !scope || typeof scope !== 'string' ||
            !authuser || typeof authuser !== 'string' ||
            !prompt || typeof prompt !== 'string'
        ) {
            res.redirect(`${FRONTEND_OAUTH_URL}?status=invalid_params`);
            return;
        }

        const redirect_uri = `${process.env.BACKEND_BASE_URL}/api/auth/google/callback`;

        const params = new URLSearchParams({
            code,
            client_id: process.env.GOOGLE_CLIENT_ID ?? '',
            client_secret: process.env.GOOGLE_SECRET ?? '',
            redirect_uri,
            grant_type: 'authorization_code',
        });

        const tokenDataRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString(),
        });

        const tokenData: GoogleTokenResponse = await tokenDataRes.json();

        if (tokenData.error) {
            res.redirect(`${FRONTEND_OAUTH_URL}?status=token_error`);
            return;
        }

        const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });

        const userInfo: GoogleUserInfo = await userInfoResponse.json();

        const ip = getClientIp(req);
        const userAgent = req.headers['user-agent'] ?? '';

        const userName = [userInfo.given_name, userInfo.family_name].filter(Boolean).join(' ') || userInfo.name || '';

        let user = await User.findOne({ email: userInfo.email });

        if (!user) {
            if (!userName) {
                res.redirect(`${FRONTEND_OAUTH_URL}?status=incomplete_info`);
                return;
            }

            user = await User.create({
                name: userName,
                email: userInfo.email,
                role,
                isEmailVerified: userInfo.verified_email,
            });
        }

        const sessionResult = await generateSession({
            ip,
            userAgent,
            userId: user._id.toString(),
        });

        if (!sessionResult.isSuccessful) {
            res.redirect(`${FRONTEND_OAUTH_URL}?status=session_failed`);
            return;
        }

        res.cookie(config['REFRESH_TOKEN_COOKIE_NAME'], sessionResult.token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
            maxAge: 30 * 24 * 60 * 60 * 1000,
        });

        res.redirect(`${FRONTEND_OAUTH_URL}?status=success`);
    } catch (error) {
        logger.error(`Error on @googleCallback: ${(error as Error)?.message ?? error}`);
        res.redirect(`${FRONTEND_OAUTH_URL}?status=server_error`);
    }
};
