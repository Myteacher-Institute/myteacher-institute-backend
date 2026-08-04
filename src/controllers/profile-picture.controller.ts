import { Request, Response } from "express";
import fs from "fs";
import path from "path";
import { Instructor } from "../models/instructor.model";
import User from "../models/user.model";
import { PROFILE_UPLOAD_DIR } from "../config/profile-upload";

const getBaseUrl = (req: Request): string => {
    if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL.replace(/\/$/, '');
    const host = req.get('host') || `localhost:${process.env.PORT || 4000}`;
    return `${req.protocol || 'http'}://${host}`;
};

// Remove the previously uploaded picture file when it belongs to us, so we
// don't leave orphaned files behind. Base64 values stored before this flow
// existed are left untouched.
const cleanupPrevious = (current: string | undefined) => {
    if (!current || !current.includes('/uploads/profile-pictures/')) return;
    const oldFile = path.join(PROFILE_UPLOAD_DIR, path.basename(current));
    if (fs.existsSync(oldFile)) {
        fs.unlink(oldFile, () => {});
    }
};

const handleUploadInstructorProfilePicture = async (req: Request, res: Response) => {
    try {
        const instructorId = req.userId;
        if (!instructorId) {
            if (req.file?.path) fs.unlink(req.file.path, () => {});
            return res.status(401).json({
                status: "failed",
                message: "Unauthorized: Instructor ID not found"
            });
        }

        if (!req.file) {
            return res.status(400).json({
                status: "failed",
                message: "No image file provided"
            });
        }

        const instructor = await Instructor.findById(instructorId);
        if (!instructor) {
            if (req.file.path) fs.unlink(req.file.path, () => {});
            return res.status(404).json({
                status: "failed",
                message: "Instructor not found"
            });
        }

        const url = `${getBaseUrl(req)}/uploads/profile-pictures/${req.file.filename}`;
        const oldPicture = instructor.profilePicture;
        instructor.profilePicture = url;
        await instructor.save();

        cleanupPrevious(oldPicture);

        return res.status(200).json({
            status: "success",
            message: "Profile picture updated successfully",
            profilePicture: url
        });
    } catch (error) {
        if (req.file?.path) fs.unlink(req.file.path, () => {});
        console.error('Upload instructor profile picture error --->', (error as Error)?.message ?? error);
        res.status(500).json({
            status: "failed",
            message: "Internal server error"
        });
    }
};

const handleUploadUserProfilePicture = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        if (!userId) {
            if (req.file?.path) fs.unlink(req.file.path, () => {});
            return res.status(401).json({
                status: "failed",
                message: "Unauthorized: User ID not found"
            });
        }

        if (!req.file) {
            return res.status(400).json({
                status: "failed",
                message: "No image file provided"
            });
        }

        const user = await User.findById(userId);
        if (!user) {
            if (req.file.path) fs.unlink(req.file.path, () => {});
            return res.status(404).json({
                status: "failed",
                message: "User not found"
            });
        }

        const url = `${getBaseUrl(req)}/uploads/profile-pictures/${req.file.filename}`;
        const oldPicture = user.profilePicture;
        user.profilePicture = url;
        await user.save();

        cleanupPrevious(oldPicture);

        return res.status(200).json({
            status: "success",
            message: "Profile picture updated successfully",
            profilePicture: url
        });
    } catch (error) {
        if (req.file?.path) fs.unlink(req.file.path, () => {});
        console.error('Upload user profile picture error --->', (error as Error)?.message ?? error);
        res.status(500).json({
            status: "failed",
            message: "Internal server error"
        });
    }
};

export { handleUploadInstructorProfilePicture, handleUploadUserProfilePicture };
