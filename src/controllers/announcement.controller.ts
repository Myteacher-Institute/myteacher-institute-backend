import { Request, Response } from "express";
import mongoose from "mongoose";
import Announcement from "../models/announcement.model";

const handleCreateAnnouncement = async (req: Request<{}, {}, { title: string; content: string; targetAudience?: string; priority?: string }>, res: Response) => {
    try {
        const adminId = req.userId;

        if (!adminId) {
            return res.status(401).json({
                status: "failed",
                message: "Unauthorized: Admin ID not found"
            });
        }

        const { title, content, targetAudience = 'all', priority = 'medium' } = req.body;

        if (!title || !content) {
            return res.status(400).json({
                status: "failed",
                message: "Title and content are required"
            });
        }

        const announcement = await Announcement.create({
            title,
            content,
            createdBy: new mongoose.Types.ObjectId(adminId),
            targetAudience,
            priority,
            isActive: true
        });

        res.status(201).json({
            status: "success",
            message: "Announcement created successfully",
            announcement
        });

    } catch (error) {
        console.error('Create announcement error --->', (error as Error)?.message ?? error);
        res.status(500).json({
            status: "failed",
            message: "Internal server error"
        });
    }
};

const handleGetInstructorAnnouncements = async (req: Request, res: Response) => {
    try {
        const instructorId = req.userId;

        if (!instructorId) {
            return res.status(401).json({
                status: "failed",
                message: "Unauthorized: Instructor ID not found"
            });
        }

        // Get announcements for instructors or all, excluding hidden ones
        const announcements = await Announcement.find({
            targetAudience: { $in: ['all', 'instructors'] },
            isActive: true,
            'hiddenBy.userId': { $ne: new mongoose.Types.ObjectId(instructorId) }
        })
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 });

        // Mark which announcements have been read by this instructor
        const announcementsWithReadStatus = announcements.map(announcement => {
            const isRead = announcement.readBy?.some(
                (read: any) => read.userId.toString() === instructorId
            );
            return {
                ...announcement.toObject(),
                isRead
            };
        });

        res.status(200).json({
            status: "success",
            announcements: announcementsWithReadStatus
        });

    } catch (error) {
        console.error('Get instructor announcements error --->', (error as Error)?.message ?? error);
        res.status(500).json({
            status: "failed",
            message: "Internal server error"
        });
    }
};

const handleMarkAsRead = async (req: Request<{ announcementId: string }>, res: Response) => {
    try {
        const instructorId = req.userId;
        const { announcementId } = req.params;

        if (!instructorId) {
            return res.status(401).json({
                status: "failed",
                message: "Unauthorized: Instructor ID not found"
            });
        }

        const announcement = await Announcement.findById(announcementId);

        if (!announcement) {
            return res.status(404).json({
                status: "failed",
                message: "Announcement not found"
            });
        }

        // Check if already read
        const alreadyRead = announcement.readBy?.some(
            (read: any) => read.userId.toString() === instructorId
        );

        if (!alreadyRead) {
            announcement.readBy = announcement.readBy || [];
            announcement.readBy.push({
                userId: new mongoose.Types.ObjectId(instructorId),
                readAt: new Date()
            });
            await announcement.save();
        }

        res.status(200).json({
            status: "success",
            message: "Announcement marked as read"
        });

    } catch (error) {
        console.error('Mark as read error --->', (error as Error)?.message ?? error);
        res.status(500).json({
            status: "failed",
            message: "Internal server error"
        });
    }
};

const handleHideAnnouncement = async (req: Request<{ announcementId: string }>, res: Response) => {
    try {
        const instructorId = req.userId;
        const { announcementId } = req.params;

        if (!instructorId) {
            return res.status(401).json({
                status: "failed",
                message: "Unauthorized: Instructor ID not found"
            });
        }

        const announcement = await Announcement.findById(announcementId);

        if (!announcement) {
            return res.status(404).json({
                status: "failed",
                message: "Announcement not found"
            });
        }

        // Check if already hidden
        const alreadyHidden = announcement.hiddenBy?.some(
            (hidden: any) => hidden.userId.toString() === instructorId
        );

        if (!alreadyHidden) {
            announcement.hiddenBy = announcement.hiddenBy || [];
            announcement.hiddenBy.push({
                userId: new mongoose.Types.ObjectId(instructorId),
                hiddenAt: new Date()
            });
            await announcement.save();
        }

        res.status(200).json({
            status: "success",
            message: "Announcement hidden"
        });

    } catch (error) {
        console.error('Hide announcement error --->', (error as Error)?.message ?? error);
        res.status(500).json({
            status: "failed",
            message: "Internal server error"
        });
    }
};

const handleGetAllAnnouncements = async (req: Request, res: Response) => {
    try {
        const adminId = req.userId;

        if (!adminId) {
            return res.status(401).json({
                status: "failed",
                message: "Unauthorized: Admin ID not found"
            });
        }

        const announcements = await Announcement.find()
            .populate('createdBy', 'name email')
            .sort({ createdAt: -1 });

        res.status(200).json({
            status: "success",
            announcements
        });

    } catch (error) {
        console.error('Get all announcements error --->', (error as Error)?.message ?? error);
        res.status(500).json({
            status: "failed",
            message: "Internal server error"
        });
    }
};

export {
    handleCreateAnnouncement,
    handleGetInstructorAnnouncements,
    handleMarkAsRead,
    handleHideAnnouncement,
    handleGetAllAnnouncements
};