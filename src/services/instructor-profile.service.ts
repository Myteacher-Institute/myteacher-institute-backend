import { Instructor } from "../models/instructor.model";
import bcrypt from "bcryptjs";
import { sendAccountDeletionEmail } from "./email.service";

export const editInstructorProfile = async (instructorId: string, profileData: any) => {
    try {
        const instructor = await Instructor.findById(instructorId);
        
        if (!instructor) {
            return { success: false, message: "Instructor not found" };
        }

        // Update only provided fields
        if (profileData.name) instructor.name = profileData.name;
        if (profileData.email) instructor.email = profileData.email;
        if (profileData.phone) instructor.phone = profileData.phone;
        if (profileData.bio) instructor.bio = profileData.bio;
        if (profileData.expertise) instructor.expertise = profileData.expertise;
        if (profileData.profilePicture) instructor.profilePicture = profileData.profilePicture;

        await instructor.save();

        return { success: true, data: instructor };
    } catch (error) {
        console.error('Error editing instructor profile:', error);
        return { success: false, message: 'Failed to update profile' };
    }
};

export const sendDeleteAccountOTP = async (instructorId: string) => {
    try {
        const instructor = await Instructor.findById(instructorId);
        
        if (!instructor) {
            return { success: false, message: "Instructor not found" };
        }

        const deleteCode = Math.floor(100000 + Math.random() * 900000).toString();
        const deleteTokenExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        instructor.deleteAccountToken = deleteCode;
        instructor.deleteAccountExpiry = deleteTokenExpiry;
        await instructor.save();

        const result = await sendAccountDeletionEmail(instructor.email, instructor.name, deleteCode);

        if (result === 'error') {
            return {
                success: false,
                message: "Failed to send deletion email"
            };
        }

        return { success: true, message: "OTP sent to your email" };
    } catch (error) {
        console.error('Error sending delete account OTP:', error);
        return { success: false, message: 'Failed to send OTP' };
    }
};

export const deleteInstructorAccount = async (instructorId: string, otp: string, reason?: string) => {
    try {
        const instructor = await Instructor.findById(instructorId);
        
        if (!instructor) {
            return { success: false, message: "Instructor not found" };
        }

        // Verify OTP
        if (!instructor.deleteAccountToken || !instructor.deleteAccountExpiry) {
            return { success: false, message: "No deletion request found. Please request a new OTP." };
        }

        if (instructor.deleteAccountExpiry < new Date()) {
            return { success: false, message: "OTP has expired. Please request a new OTP." };
        }

        if (instructor.deleteAccountToken !== otp) {
            return { success: false, message: "Invalid OTP" };
        }

        // Delete instructor
        await Instructor.findByIdAndDelete(instructorId);

        return { success: true, message: "Account deleted successfully" };
    } catch (error) {
        console.error('Error deleting instructor account:', error);
        return { success: false, message: 'Failed to delete account' };
    }
};
