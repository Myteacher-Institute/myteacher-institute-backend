import { Router } from 'express';
import { ProtectMiddleWare } from '../middleware/protect-route';
import { handleCreatePayment, handleVerifyPayment, handleGetPaymentStatus, handleGetUserTransactions, handleGetTransactionByRef } from '../controllers/payment.controller';
import rateLimit from 'express-rate-limit';

const paymentRoute: Router = Router();

// Rate limiter for payment operations
const paymentLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // Limit each IP to 20 payment operations per 15 minutes
    message: {
        error: "Too many payment operations, please try again after 15 minutes"
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Create payment link for course purchase (requires authentication)
paymentRoute.post('/create', ProtectMiddleWare, paymentLimiter, handleCreatePayment);

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
