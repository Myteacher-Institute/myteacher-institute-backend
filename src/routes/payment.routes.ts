import { Router, Request, Response, NextFunction } from 'express';
import { ProtectMiddleWare } from '../middleware/protect-route';
import { handleCreatePayment, handleVerifyPayment, handleGetPaymentStatus, handleGetUserTransactions, handleGetTransactionByRef } from '../controllers/payment.controller';

const paymentRoute: Router = Router();

console.log('[PAYMENT-ROUTES] Payment routes module loaded');

// Manual in-memory rate limiter for payment operations
const paymentRateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX = 20; // 20 requests per window

const manualPaymentRateLimiter = (req: Request, res: Response, next: NextFunction) => {
    console.log('[PAYMENT-LIMITER] Request received for /api/payment/create');
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const record = paymentRateLimitMap.get(ip);

    if (!record || now > record.resetTime) {
        paymentRateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
        console.log('[PAYMENT-LIMITER] Request allowed - new window');
        return next();
    }

    if (record.count >= RATE_LIMIT_MAX) {
        console.log('[PAYMENT-LIMITER] Request rate limited');
        return res.status(429).json({
            status: 'failed',
            message: 'Too many payment operations, please try again after 15 minutes'
        });
    }

    record.count++;
    console.log('[PAYMENT-LIMITER] Request allowed - count:', record.count);
    return next();
};

// Create payment link for course purchase (requires authentication)
paymentRoute.post('/create', (req, res, next) => {
    console.log('[PAYMENT-ROUTE] POST /create called');
    next();
}, ProtectMiddleWare, manualPaymentRateLimiter, handleCreatePayment);

// Verify payment after Flutterwave callback (requires authentication)
paymentRoute.get('/verify', ProtectMiddleWare, handleVerifyPayment);

// Get user's transaction history (requires authentication)
paymentRoute.get('/history', ProtectMiddleWare, handleGetUserTransactions);

// Check payment status and reconcile stuck pending payments (requires authentication)
// Must come before /:tx_ref so it isn't shadowed by the generic route.
paymentRoute.get('/status/:tx_ref', ProtectMiddleWare, handleGetPaymentStatus);

// Get transaction by reference (requires authentication)
paymentRoute.get('/:tx_ref', ProtectMiddleWare, handleGetTransactionByRef);

export default paymentRoute;
