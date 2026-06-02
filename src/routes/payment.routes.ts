import { Router } from 'express';
import { handleCreatePayment, handleVerifyPayment, handleGetUserTransactions, handleGetTransactionByRef } from '../controllers/payment.controller';
import { ProtectMiddleWare } from '../middleware/protect-route';

const router: Router = Router();

// Create payment link for course purchase (requires authentication)
router.post('/create', ProtectMiddleWare, handleCreatePayment);

// Verify payment after Flutterwave callback (requires authentication)
router.get('/verify', ProtectMiddleWare, handleVerifyPayment);

// Get user's transaction history (requires authentication)
router.get('/history', ProtectMiddleWare, handleGetUserTransactions);

// Get transaction by reference (requires authentication)
router.get('/:tx_ref', ProtectMiddleWare, handleGetTransactionByRef);

export default router;
