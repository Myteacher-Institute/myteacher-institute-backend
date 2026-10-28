import { Router } from "express";
import { isInstructor } from "../middleware/is-instructor";
import { ProtectMiddleWare } from "../middleware/protect-route";
import {
    handleCreateCommunity,
    handleGetAllCommunities,
    handleGetCommunityById,
    handleJoinCommunity,
    handleLeaveCommunity,
    handlePostContent,
    handleLikePost,
    handleCommentPost
} from "../controllers/community.controller";
import rateLimit from "express-rate-limit";

const communityRouter: Router = Router();

// Rate limiter for community operations
const communityOperationLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // Limit each IP to 50 community operations per 15 minutes
    message: {
        error: "Too many community operations, please try again after 15 minutes"
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Create community (instructor only)
communityRouter.post("/create", ProtectMiddleWare, isInstructor, communityOperationLimiter, handleCreateCommunity);

// Get all communities (public)
communityRouter.get("/all", handleGetAllCommunities);

// Get community by ID (public)
communityRouter.get("/:communityId", handleGetCommunityById);

// Join community (protected)
communityRouter.post("/:communityId/join", ProtectMiddleWare, communityOperationLimiter, handleJoinCommunity);

// Leave community (protected)
communityRouter.post("/:communityId/leave", ProtectMiddleWare, communityOperationLimiter, handleLeaveCommunity);

// Post content to community (protected)
communityRouter.post("/:communityId/posts", ProtectMiddleWare, communityOperationLimiter, handlePostContent);

// Like post (protected)
communityRouter.post("/:communityId/posts/:postId/like", ProtectMiddleWare, communityOperationLimiter, handleLikePost);

// Comment on post (protected)
communityRouter.post("/:communityId/posts/:postId/comment", ProtectMiddleWare, communityOperationLimiter, handleCommentPost);

export default communityRouter;
