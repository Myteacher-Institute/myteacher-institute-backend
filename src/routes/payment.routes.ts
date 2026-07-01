import { Router } from 'express';
import { ProtectMiddleWare } from '../middleware/protect-route';
import { handleCreatePayment, handleVerifyPayment, handleGetUserTransactions, handleGetTransactionByRef } from '../controllers/payment.controller';

const paymentRoute: Router = Router();

// Create payment link for course purchase (requires authentication)
paymentRoute.post('/create', ProtectMiddleWare, handleCreatePayment);

// Verify payment after Flutterwave callback (requires authentication)
paymentRoute.get('/verify', ProtectMiddleWare, handleVerifyPayment);

// Get user's transaction history (requires authentication)
paymentRoute.get('/history', ProtectMiddleWare, handleGetUserTransactions);

// Get transaction by reference (requires authentication)
paymentRoute.get('/:tx_ref', ProtectMiddleWare, handleGetTransactionByRef);

export default paymentRoute;
