import crypto from 'crypto';
import User from '../models/user.model';
import { Instructor } from '../models/instructor.model';

// Generates a 6-char alphanumeric code + 8-char hash derived from the owner id.
// The hash makes the id non-enumerable while keeping it short enough to share.
const generateAffiliateId = (ownerId: string): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const hash = crypto.createHash('sha256').update(result + ownerId).digest('hex');
    return result + hash.substring(0, 8);
};

export interface EnsureAffiliateAccountResult {
    ok: boolean;
    created: boolean;
    affiliate_id?: string;
    reason?: 'not-found' | 'generation-failed';
}

/**
 * Makes sure a user or instructor has an affiliate account, creating one
 * (with a unique affiliate_id) when it is missing or empty.
 *
 * This is safe to call on every login / signup completion — it is idempotent
 * and returns the existing affiliate_id when already set.
 */
export const ensureAffiliateAccount = async (
    userId: string,
    userType: 'user' | 'instructor'
): Promise<EnsureAffiliateAccountResult> => {
    try {
        const Model: typeof User = (userType === 'user' ? User : Instructor) as typeof User;

        const user = await Model.findById(userId);
        if (!user) {
            return { ok: false, created: false, reason: 'not-found' };
        }

        if (user.affiliate_id) {
            return { ok: true, created: false, affiliate_id: user.affiliate_id };
        }

        // Generate a unique affiliate id that is not used by any user or instructor.
        let affiliateId: string | undefined;
        let isUnique = false;
        let attempts = 0;

        while (!isUnique && attempts < 10) {
            const candidate = generateAffiliateId(userId);
            const existingUser = await User.findOne({ affiliate_id: candidate });
            const existingInstructor = await Instructor.findOne({ affiliate_id: candidate });

            if (!existingUser && !existingInstructor) {
                affiliateId = candidate;
                isUnique = true;
            }
            attempts++;
        }

        if (!affiliateId) {
            return { ok: false, created: false, reason: 'generation-failed' };
        }

        const update: {
            affiliate_id: string;
            affiliate_money: number;
            hasAffiliateAccount: boolean;
        } = {
            affiliate_id: affiliateId,
            affiliate_money: user.affiliate_money ?? 0,
            hasAffiliateAccount: true,
        };

        await Model.findByIdAndUpdate(userId, { $set: update });

        return { ok: true, created: true, affiliate_id: affiliateId };
    } catch (error) {
        console.error('Error on @ensureAffiliateAccount:', (error as Error)?.message ?? error);
        return { ok: false, created: false };
    }
};
