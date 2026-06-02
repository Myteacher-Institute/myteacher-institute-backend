import bcrypt from 'bcryptjs';
import { User } from '@/models';

type CompleteOnboardingInput = {
    name: string;
    userId: string;
    password: string;
};

type CompleteOnboardingResult =
    | { isSuccessful: true }
    | { isSuccessful: false; reason: string };

export const completeOnboarding = async ({
    name,
    userId,
    password,
}: CompleteOnboardingInput): Promise<CompleteOnboardingResult> => {
    try {
        const user = await User.findById(userId);

        if (!user) {
            return { isSuccessful: false, reason: 'User not found' };
        }

        if (user.hasOnboarded) {
            return { isSuccessful: false, reason: 'User already onboarded' };
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await User.updateOne(
            { _id: userId },
            {
                $set: {
                    name,
                    password: hashedPassword,
                    hasOnboarded: true,
                },
            }
        );

        return { isSuccessful: true };
    } catch (err) {
        return { isSuccessful: false, reason: 'Onboarding failed' };
    }
};
