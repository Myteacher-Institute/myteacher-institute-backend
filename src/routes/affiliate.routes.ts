import express, { Router } from 'express';
import { activateAffiliateAccount, generateAffiliateLink, getAffiliateStats, getAffiliateStatus, getRecentReferrals, createWithdrawal, getWithdrawals, adminProcessWithdrawal, getAdminPendingWithdrawals, getBanks } from '../controllers/affiliate.controller';
import { ProtectMiddleWare } from '../middleware/protect-route';
import rateLimit from "express-rate-limit";

const router: Router = express.Router();

// All affiliate routes require authentication
router.use(ProtectMiddleWare);

const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: {
        error: "Too many requests from this IP, please try again after 15 minutes"
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Activate affiliate account
router.post('/activate', activateAffiliateAccount);

// Get affiliate status for the authenticated account
router.get('/status', getAffiliateStatus);

// Generate affiliate link for a course
router.post('/generate-link', generateAffiliateLink);

// Get affiliate statistics
router.post('/stats', getAffiliateStats);

// Get recent referrals
router.get('/referrals', getRecentReferrals);

// Create withdrawal request
router.post('/withdrawal', createWithdrawal);

// Get withdrawal history
router.get('/withdrawals', getWithdrawals);

// Admin routes
router.post('/admin/withdrawals/:withdrawalId/process', adminProcessWithdrawal);
router.get('/admin/withdrawals/pending', getAdminPendingWithdrawals);

// Get bank list for withdrawals
router.get('/banks', getBanks);

export default router;
