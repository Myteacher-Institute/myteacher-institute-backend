import { Router } from "express";
import {
  handleGetTokenBalance,
  handleGetTokenPackages,
  handleCreateTokenPurchase,
  handleRecordTokenUsage,
  handleGetTokenUsageHistory,
  handleVerifyTokenPurchase
} from "../controllers/ai-token.controller";
import { handleAIChat } from "../controllers/ai-chat.controller";
import { ProtectMiddleWare } from "../middleware/protect-route";
import rateLimit from "express-rate-limit";

const aiTokenRouter: Router = Router();

// Rate limiters for token operations
const purchaseLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 purchase attempts per 15 minutes
  message: {
    error: "Too many purchase attempts, please try again after 15 minutes"
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const usageLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // Limit each IP to 60 usage records per minute
  message: {
    error: "Too many usage records, please slow down"
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const chatLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // Limit each IP to 20 chat requests per minute
  message: {
    error: "Too many chat requests, please slow down"
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Get user's token balance
aiTokenRouter.get("/balance", ProtectMiddleWare, handleGetTokenBalance);

// Get available token packages
aiTokenRouter.get("/packages", ProtectMiddleWare, handleGetTokenPackages);

// Create token purchase (initiate Flutterwave payment)
aiTokenRouter.post("/purchase", ProtectMiddleWare, purchaseLimiter, handleCreateTokenPurchase);

// Verify token purchase (Flutterwave callback)
aiTokenRouter.get("/verify", ProtectMiddleWare, handleVerifyTokenPurchase);

// Record AI token usage (called after AI response)
aiTokenRouter.post("/usage", ProtectMiddleWare, usageLimiter, handleRecordTokenUsage);

// Get token usage history
aiTokenRouter.get("/history", ProtectMiddleWare, handleGetTokenUsageHistory);

// AI Chat endpoint
aiTokenRouter.post("/chat", ProtectMiddleWare, chatLimiter, handleAIChat);

export default aiTokenRouter;