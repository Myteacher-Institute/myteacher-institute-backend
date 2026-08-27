import logger from '../utils';

// E.164 format: + followed by 8-15 digits (country code max 4 digits included)
const E164_REGEX = /^\+[1-9]\d{7,14}$/;

/**
 * Normalize a raw phone input into E.164 (+<digits>).
 * Strips spaces, dashes, parentheses and leading zeros / double country codes.
 */
export const normalizePhoneNumber = (raw: string): string | null => {
    if (!raw) return null;
    let cleaned = raw.replace(/[\s\-().]/g, '');
    // Replace 00 international prefix with +
    if (cleaned.startsWith('00')) {
        cleaned = `+${cleaned.slice(2)}`;
    }
    if (!cleaned.startsWith('+')) {
        cleaned = `+${cleaned}`;
    }
    return E164_REGEX.test(cleaned) ? cleaned : null;
};

export interface WhatsAppCheckResult {
    valid: boolean;
    normalizedNumber: string | null;
    onWhatsApp: boolean;
    checked: boolean;
    message?: string;
}

/**
 * Check whether a phone number has a registered WhatsApp account using
 * WhatsApp's public click-to-chat endpoint. This is best-effort — when the
 * endpoint cannot be reached the caller decides how to proceed.
 */
const checkNumberOnWhatsApp = async (normalizedNumber: string): Promise<{ onWhatsApp: boolean; checked: boolean }> => {
    try {
        const response = await fetch(`https://api.whatsapp.com/send?phone=${encodeURIComponent(normalizedNumber.replace('+', ''))}`, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
            },
            signal: AbortSignal.timeout(10000),
        });

        if (!response.ok && response.status !== 200) {
            return { onWhatsApp: false, checked: false };
        }

        const html = await response.text();
        const invalidMarkers = [
            'phone number shared via url is invalid',
            'Phone number shared via url is invalid.',
            'we couldn&#39;t find the phone number',
        ];

        const lowerHtml = html.toLowerCase();
        const looksInvalid = invalidMarkers.some(marker => lowerHtml.includes(marker.toLowerCase()));

        return { onWhatsApp: !looksInvalid, checked: true };
    } catch (error) {
        logger.error(`WhatsApp number check failed for ${normalizedNumber}: ${(error as Error)?.message ?? error}`);
        return { onWhatsApp: false, checked: false };
    }
};

/**
 * Validate a WhatsApp number before a mentor activates mentorship.
 * - Format must be valid E.164 (hard requirement).
 * - Existence on WhatsApp is verified via the public endpoint; when the
 *   verification service is unreachable we fall back to format-only validity.
 */
export const validateWhatsAppNumber = async (rawNumber: string): Promise<WhatsAppCheckResult> => {
    const normalizedNumber = normalizePhoneNumber(rawNumber);

    if (!normalizedNumber) {
        return {
            valid: false,
            normalizedNumber: null,
            onWhatsApp: false,
            checked: false,
            message: 'Invalid phone number. Use international format e.g. +2348012345678'
        };
    }

    const { onWhatsApp, checked } = await checkNumberOnWhatsApp(normalizedNumber);

    if (checked && !onWhatsApp) {
        return {
            valid: false,
            normalizedNumber,
            onWhatsApp: false,
            checked: true,
            message: 'This number does not appear to be registered on WhatsApp'
        };
    }

    return {
        valid: true,
        normalizedNumber,
        onWhatsApp,
        checked,
        message: checked ? 'Number verified on WhatsApp' : 'Number format is valid (WhatsApp could not be verified right now)'
    };
};
