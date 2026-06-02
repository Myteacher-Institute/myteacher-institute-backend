import bcrypt from 'bcryptjs';
import { User } from '@/models';
import { IUser } from '@/types';

type CompleteOnboardingInput = {
    name: string;
    userId: string;
    password: string;
};

type CompleteOnboardingResult =
    | { isSuccessful: true; user: IUser }
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

        const updatedUser = await User.findById(userId);
        if (!updatedUser) {
            return { isSuccessful: false, reason: 'Unable to load updated user' };
        }

        return { isSuccessful: true, user: updatedUser };
    } catch (err) {
        return { isSuccessful: false, reason: 'Onboarding failed' };
    }
};
