import { Router } from "express";
import {
    handleCreateAnnouncement,
    handleGetInstructorAnnouncements,
    handleMarkAsRead,
    handleHideAnnouncement,
    handleGetAllAnnouncements
} from "../controllers/announcement.controller";
import { ProtectMiddleWare } from "../middleware/protect-route";
import { isAdmin } from "../middleware/is-admin";
import rateLimit from "express-rate-limit";

const announcementRouter: Router = Router();

// Rate limiter for announcement operations
const announcementLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // Limit each IP to 20 announcement operations per 15 minutes
    message: {
        error: "Too many announcement operations, please try again after 15 minutes"
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Admin routes
announcementRouter.post("/create", ProtectMiddleWare, isAdmin, announcementLimiter, handleCreateAnnouncement);
announcementRouter.get("/all", ProtectMiddleWare, isAdmin, handleGetAllAnnouncements);

// Instructor routes
announcementRouter.get("/instructor", ProtectMiddleWare, handleGetInstructorAnnouncements);
announcementRouter.patch("/:announcementId/read", ProtectMiddleWare, handleMarkAsRead);
announcementRouter.patch("/:announcementId/hide", ProtectMiddleWare, handleHideAnnouncement);

export default announcementRouter;