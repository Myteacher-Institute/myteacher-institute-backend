import { Router } from "express";
import {
    handleBecomeMentor,
    handleGetMentorStatus,
    handleGetAllMentors,
    handleRequestMentorship,
    handleGetInstructorMentorRequests,
    handleAcceptMentorshipRequest,
    handleRejectMentorshipRequest,
    handleCreateMentorshipPayment,
    handleRenewMentorship,
    handleDeleteMentorship,
} from "../controllers/mentor.controller";
import { ProtectMiddleWare } from "../middleware/protect-route";
import rateLimit from "express-rate-limit";

const mentorRouter: Router = Router();

// ── Rate limiters ────────────────────────────────────────────────

// Authenticated — request / pay / accept / reject (moderate)
const actionLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { error: "Too many requests, please try again after 15 minutes" },
    standardHeaders: true,
    legacyHeaders: false,
});

// Strict — submit mentorship request (prevents spam)
const requestLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: "Too many mentorship requests, please try again later" },
    standardHeaders: true,
    legacyHeaders: false,
});

// Very strict — activate / deactivate mentorship
const becomeLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { error: "Too many changes, please try again later" },
    standardHeaders: true,
    legacyHeaders: false,
});

// ── Routes ───────────────────────────────────────────────────────

// Public — anyone (including guests) can browse available mentors.
// GET /api/mentor            → all mentors
// GET /api/mentor?limit=3    → top 3 (used by the landing page mini cards)
mentorRouter.get("/",  handleGetAllMentors);

// Student — request a specific mentor (auth required)
mentorRouter.post("/request", ProtectMiddleWare, requestLimiter, handleRequestMentorship);

// Instructor — mentorship activation & status
mentorRouter.get("/status", ProtectMiddleWare, handleGetMentorStatus);
mentorRouter.patch("/become", ProtectMiddleWare, becomeLimiter, handleBecomeMentor);

// Student — pay for an accepted request (fresh Flutterwave link)
mentorRouter.post("/requests/:requestId/pay", ProtectMiddleWare, actionLimiter, handleCreateMentorshipPayment);

// Student — renew an ended mentorship
mentorRouter.post("/mentorships/:mentorshipId/renew", ProtectMiddleWare, actionLimiter, handleRenewMentorship);

// Student — end/delete a mentorship
mentorRouter.delete("/mentorships/:mentorshipId", ProtectMiddleWare, actionLimiter, handleDeleteMentorship);

// Instructor — incoming requests
mentorRouter.get("/requests", ProtectMiddleWare, handleGetInstructorMentorRequests);
mentorRouter.patch("/requests/:requestId/accept", ProtectMiddleWare, actionLimiter, handleAcceptMentorshipRequest);
mentorRouter.patch("/requests/:requestId/reject", ProtectMiddleWare, actionLimiter, handleRejectMentorshipRequest);

export default mentorRouter;
