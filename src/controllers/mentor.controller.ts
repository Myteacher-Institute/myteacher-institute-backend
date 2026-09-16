import { Request, Response } from "express";
import {
    becomeMentor,
    getMentorStatus,
    getAllMentors,
    requestMentorship,
    getInstructorMentorRequests,
    acceptMentorshipRequest,
    rejectMentorshipRequest,
    createMentorshipPayment,
    getStudentMentorships,
    renewMentorship,
    deleteMentorship,
} from "../services/mentor.service";
import { AcceptMentorshipReqBody, BecomeMentorReqBody, BecomeMentorResT, CreateMentorshipPaymentResT, RequestMentorshipReqBody, RequestMentorshipResT } from "../types";
import { cacheGet, cacheSet } from "../config/redis";

// PATCH /api/mentor/become — instructor activates/deactivates mentorship
const handleBecomeMentor = async (req: Request<{}, {}, BecomeMentorReqBody>, res: Response<BecomeMentorResT>) => {
    try {
        const instructorId = req.userId;
        if (!instructorId) {
            return res.status(401).json({ status: "failed", message: "Unauthorized: Instructor ID not found" });
        }

        const result = await becomeMentor(instructorId, req.body);

        if (!result.success) {
            return res.status(400).json({ status: "failed", message: result.message });
        }

        return res.status(200).json({
            status: "success",
            message: result.message,
            instructor: {
                isMentor: (result.instructor as any)?.isMentor,
                whatsappNumber: (result.instructor as any)?.whatsappNumber,
                mentorshipPrice: (result.instructor as any)?.mentorshipPrice,
                mentorshipBio: (result.instructor as any)?.mentorshipBio,
            },
        });
    } catch (error) {
        console.error('Become mentor controller error --->', (error as Error)?.message ?? error);
        return res.status(500).json({ status: "failed", message: "Internal server error" });
    }
};

// GET /api/mentor/status — current instructor's mentorship profile
const handleGetMentorStatus = async (_req: Request, res: Response<any>) => {
    try {
        const instructorId = _req.userId;
        if (!instructorId) {
            return res.status(401).json({ status: "failed", message: "Unauthorized: Instructor ID not found" });
        }

        const cacheKey = `mentor:${instructorId}:status`;
        const cachedStatus = await cacheGet(cacheKey);
        if (cachedStatus) {
            console.log('📦 Serving mentor status from cache');
            return res.status(200).json({
                status: "success",
                isMentor: cachedStatus.isMentor,
                mentorProfile: cachedStatus.mentorProfile,
            });
        }

        const result = await getMentorStatus(instructorId);

        if (!result.success) {
            return res.status(404).json({ status: "failed", message: result.message });
        }

        await cacheSet(cacheKey, { isMentor: result.isMentor, mentorProfile: result.mentorProfile }, 60);

        return res.status(200).json({
            status: "success",
            isMentor: result.isMentor,
            mentorProfile: result.mentorProfile,
        });
    } catch (error) {
        console.error('Get mentor status controller error --->', (error as Error)?.message ?? error);
        return res.status(500).json({ status: "failed", message: "Internal server error" });
    }
};

// GET /api/mentor — list available mentors (?limit=3 for the mini cards)
const handleGetAllMentors = async (req: Request, res: Response<any>) => {
    try {
        const limitParam = parseInt(req.query.limit as string);
        const limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : undefined;

        const cacheKey = `mentors:all:${limit ?? 0}`;
        const cachedMentors = await cacheGet(cacheKey);
        if (cachedMentors) {
            console.log('📦 Serving mentors from cache');
            return res.status(200).json({
                status: "success",
                message: "Mentors retrieved successfully",
                mentors: cachedMentors.mentors,
                total: cachedMentors.total,
            });
        }

        const result = await getAllMentors(limit);

        if (!result.success) {
            return res.status(500).json({ status: "failed", message: "Failed to fetch mentors", mentors: [], total: 0 });
        }

        await cacheSet(cacheKey, { mentors: result.mentors, total: result.total }, 300);

        return res.status(200).json({
            status: "success",
            message: "Mentors retrieved successfully",
            mentors: result.mentors,
            total: result.total,
        });
    } catch (error) {
        console.error('Get all mentors controller error --->', (error as Error)?.message ?? error);
        return res.status(500).json({ status: "failed", message: "Internal server error", mentors: [], total: 0 });
    }
};

// POST /api/mentor/request — student requests a specific mentor
const handleRequestMentorship = async (req: Request<{}, {}, RequestMentorshipReqBody>, res: Response<RequestMentorshipResT>) => {
    try {
        const studentId = req.userId;
        if (!studentId) {
            return res.status(401).json({ status: "failed", message: "You must be logged in to request a mentor" });
        }

        const result = await requestMentorship(studentId, req.body);

        if (!result.success) {
            return res.status(400).json({ status: "failed", message: result.message });
        }

        return res.status(201).json({
            status: "success",
            message: result.message,
            request: result.request,
        });
    } catch (error) {
        console.error('Request mentorship controller error --->', (error as Error)?.message ?? error);
        return res.status(500).json({ status: "failed", message: "Internal server error" });
    }
};

// GET /api/mentor/requests — instructor's incoming mentorship requests
const handleGetInstructorMentorRequests = async (_req: Request, res: Response<any>) => {
    try {
        const instructorId = _req.userId;
        if (!instructorId) {
            return res.status(401).json({ status: "failed", message: "Unauthorized: Instructor ID not found" });
        }

        const cacheKey = `mentor:${instructorId}:requests`;
        const cachedRequests = await cacheGet(cacheKey);
        if (cachedRequests) {
            console.log('📦 Serving mentorship requests from cache');
            return res.status(200).json({
                status: "success",
                message: "Mentorship requests retrieved successfully",
                requests: cachedRequests,
            });
        }

        const result = await getInstructorMentorRequests(instructorId);

        await cacheSet(cacheKey, result.requests, 120);

        return res.status(200).json({
            status: "success",
            message: "Mentorship requests retrieved successfully",
            requests: result.requests,
        });
    } catch (error) {
        console.error('Get instructor mentor requests controller error --->', (error as Error)?.message ?? error);
        return res.status(500).json({ status: "failed", message: "Internal server error", requests: [] });
    }
};

// PATCH /api/mentor/requests/:requestId/accept
const handleAcceptMentorshipRequest = async (req: Request<{ requestId: string }, {}, AcceptMentorshipReqBody>, res: Response<any>) => {
    try {
        const instructorId = req.userId;
        const { requestId } = req.params;

        if (!instructorId) {
            return res.status(401).json({ status: "failed", message: "Unauthorized: Instructor ID not found" });
        }

        const result = await acceptMentorshipRequest(instructorId, requestId, {
            availableTime: req.body?.availableTime,
            programDuration: req.body?.programDuration,
            groupChatLink: req.body?.groupChatLink,
            actualPrice: req.body?.actualPrice,
        });

        if (!result.success) {
            return res.status(result.message?.includes('not found') ? 404 : 400).json({
                status: "failed",
                message: result.message,
            });
        }

        return res.status(200).json({
            status: "success",
            message: result.message,
            request: result.request,
        });
    } catch (error) {
        console.error('Accept mentorship request controller error --->', (error as Error)?.message ?? error);
        return res.status(500).json({ status: "failed", message: "Internal server error" });
    }
};

// PATCH /api/mentor/requests/:requestId/reject
const handleRejectMentorshipRequest = async (req: Request<{ requestId: string }>, res: Response<any>) => {
    try {
        const instructorId = req.userId;
        const { requestId } = req.params;

        if (!instructorId) {
            return res.status(401).json({ status: "failed", message: "Unauthorized: Instructor ID not found" });
        }

        const result = await rejectMentorshipRequest(instructorId, requestId);

        if (!result.success) {
            return res.status(result.message?.includes('not found') ? 404 : 400).json({
                status: "failed",
                message: result.message,
            });
        }

        return res.status(200).json({
            status: "success",
            message: result.message,
            request: result.request,
        });
    } catch (error) {
        console.error('Reject mentorship request controller error --->', (error as Error)?.message ?? error);
        return res.status(500).json({ status: "failed", message: "Internal server error" });
    }
};

// POST /api/mentor/requests/:requestId/pay — student re-initiates payment for an accepted request
const handleCreateMentorshipPayment = async (req: Request<{ requestId: string }>, res: Response<CreateMentorshipPaymentResT>) => {
    try {
        const studentId = req.userId;
        const { requestId } = req.params;

        if (!studentId) {
            return res.status(401).json({ status: "failed", message: "You must be logged in to complete this payment" });
        }

        const result = await createMentorshipPayment(studentId, requestId);

        if (!result.success) {
            return res.status(result.message?.includes('not found') ? 404 : 400).json({
                status: "failed",
                message: result.message,
            });
        }

        return res.status(200).json({
            status: "success",
            message: result.message,
            paymentLink: result.paymentLink,
            transactionReference: result.transactionReference,
        });
    } catch (error) {
        console.error('Create mentorship payment controller error --->', (error as Error)?.message ?? error);
        return res.status(500).json({ status: "failed", message: "Internal server error" });
    }
};

// POST /api/mentor/mentorships/:mentorshipId/renew — student renews an ended mentorship
const handleRenewMentorship = async (req: Request<{ mentorshipId: string }, {}, { duration: string }>, res: Response<any>) => {
    try {
        const studentId = req.userId;
        const { mentorshipId } = req.params;
        const { duration } = req.body;

        console.log('Renew mentorship request:', { studentId, mentorshipId, duration });

        if (!studentId) {
            return res.status(401).json({ status: "failed", message: "You must be logged in to renew a mentorship" });
        }

        if (!duration) {
            return res.status(400).json({ status: "failed", message: "Duration is required" });
        }

        const result = await renewMentorship(studentId, mentorshipId, duration);

        console.log('Renew mentorship result:', result);

        if (!result.success) {
            return res.status(result.message?.includes('not found') ? 404 : 400).json({
                status: "failed",
                message: result.message,
            });
        }

        return res.status(200).json({
            status: "success",
            message: result.message,
            paymentLink: result.paymentLink,
            transactionReference: result.transactionReference,
            discountedPrice: result.discountedPrice,
            originalPrice: result.originalPrice,
        });
    } catch (error) {
        console.error('Renew mentorship controller error --->', (error as Error)?.message ?? error);
        return res.status(500).json({ status: "failed", message: "Internal server error" });
    }
};

// DELETE /api/mentor/mentorships/:mentorshipId — student ends a mentorship
const handleDeleteMentorship = async (req: Request<{ mentorshipId: string }>, res: Response<any>) => {
    try {
        const studentId = req.userId;
        const { mentorshipId } = req.params;

        if (!studentId) {
            return res.status(401).json({ status: "failed", message: "You must be logged in to end a mentorship" });
        }

        const result = await deleteMentorship(studentId, mentorshipId);

        if (!result.success) {
            return res.status(result.message?.includes('not found') ? 404 : 400).json({
                status: "failed",
                message: result.message,
            });
        }

        return res.status(200).json({
            status: "success",
            message: result.message,
        });
    } catch (error) {
        console.error('Delete mentorship controller error --->', (error as Error)?.message ?? error);
        return res.status(500).json({ status: "failed", message: "Internal server error" });
    }
};

export { handleBecomeMentor, handleGetMentorStatus, handleGetAllMentors, handleRequestMentorship, handleGetInstructorMentorRequests, handleAcceptMentorshipRequest, handleRejectMentorshipRequest, handleCreateMentorshipPayment, handleRenewMentorship, handleDeleteMentorship };
