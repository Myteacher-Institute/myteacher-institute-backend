import crypto from 'crypto';

// Single shared secret so state signed in the worker verifies in the controller.
// When OAUTH_STATE_SECRET is not set, the in-memory secret is random per process
// — in production always set OAUTH_STATE_SECRET so multiple instances agree.
const STATE_SECRET = process.env.OAUTH_STATE_SECRET as string;

export const signState = (payload: object): string => {
    const b64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = crypto.createHmac('sha256', STATE_SECRET).update(b64).digest('base64url');
    return `${b64}.${sig}`;
};

export const verifyState = (state: string): { instructorId: string } | null => {
    const parts = state.split('.');
    if (parts.length !== 2) return null;
    const [b64, sig] = parts;
    const expected = crypto.createHmac('sha256', STATE_SECRET).update(b64).digest('base64url');
    try {
        if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
        return JSON.parse(Buffer.from(b64, 'base64url').toString());
    } catch {
        return null;
    }
};
