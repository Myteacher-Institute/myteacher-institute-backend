import config from '../config/env';
import { FlutterwavePaymentResponse, FlutterwaveVerifyResponse } from '../types/transaction.type';
import Flutterwave from 'flutterwave-node-v3';

// Initialize Flutterwave instance
const flw = new Flutterwave(config.flutterwave.clientId, config.flutterwave.clientSecret);

/**
 * Create a payment link with Flutterwave using SDK
 */
export const createPaymentLink = async (params: {
    amount: number;
    currency: string;
    tx_ref: string;
    redirect_url: string;
    customer: {
        email: string;
        name: string;
    };
    customizations?: {
        title: string;
        description: string;
    };
}): Promise<FlutterwavePaymentResponse> => {
    try {
        const payload = {
            tx_ref: params.tx_ref,
            amount: params.amount,
            currency: params.currency,
            redirect_url: params.redirect_url,
            customer: params.customer,
            customizations: params.customizations || {
                title: 'Course Purchase',
                description: 'Purchase course on MyTeacher Institute'
            }
        };

        // Use Flutterwave SDK for payment link creation
        const response = await flw.PaymentLink.create(payload);

        return {
            status: response.status || 'success',
            message: response.message || 'Payment link created successfully',
            data: {
                link: response.data?.link || '',
                redirect_url: response.data?.redirect_url || ''
            }
        };
    } catch (error) {
        console.error('Flutterwave create payment error:', error);
        throw error;
    }
};

/**
 * Verify a transaction with Flutterwave using SDK
 */
export const verifyTransaction = async (transactionId: string): Promise<FlutterwaveVerifyResponse> => {
    try {
        // Use Flutterwave SDK for transaction verification
        const response = await flw.Transaction.verify({ id: transactionId });

        return {
            status: response.status || 'success',
            message: response.message || 'Transaction verified successfully',
            data: {
                status: response.data?.status || 'unknown',
                amount: response.data?.amount || 0,
                currency: response.data?.currency || 'NGN',
                tx_ref: response.data?.tx_ref || '',
                transaction_id: response.data?.id || 0,
                flw_ref: response.data?.flw_ref || '',
                customer: {
                    email: response.data?.customer?.email || '',
                    name: response.data?.customer?.name || ''
                },
                meta: {
                    authorizer: response.data?.meta?.authorizer || ''
                }
            }
        };
    } catch (error) {
        console.error('Flutterwave verify transaction error:', error);
        throw error;
    }
};

/**
 * Verify a transaction with Flutterwave using the transaction reference.
 * Used to reconcile "stuck" pending payments where we never received the
 * Flutterwave transaction id (e.g. the user never landed back on the callback).
 */
export const verifyTransactionByReference = async (txRef: string): Promise<FlutterwaveVerifyResponse> => {
    try {
        // Use Flutterwave SDK for transaction verification by reference
        const response = await (flw.Transaction as any).verify_by_tx({ tx_ref: txRef });

        return {
            status: response.status || 'success',
            message: response.message || 'Transaction verified successfully',
            data: {
                status: response.data?.status || 'unknown',
                amount: response.data?.amount || 0,
                currency: response.data?.currency || 'NGN',
                tx_ref: response.data?.tx_ref || '',
                transaction_id: response.data?.id || 0,
                flw_ref: response.data?.flw_ref || '',
                customer: {
                    email: response.data?.customer?.email || '',
                    name: response.data?.customer?.name || ''
                },
                meta: {
                    authorizer: response.data?.meta?.authorizer || ''
                }
            }
        };
    } catch (error) {
        console.error('Flutterwave verify transaction by reference error:', error);
        throw error;
    }
};

/**
 * Generate a unique transaction reference
 */
export const generateTransactionReference = (userId: string, courseId: string): string => {
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    return `MYT-${userId}-${courseId}-${timestamp}-${randomStr}`;
};

/**
 * Encrypt data using Flutterwave encryption key
 * Uses AES-256-CBC encryption as specified by Flutterwave
 */
export const encryptData = (data: string): string => {
    try {
        const encryptionKey = config.flutterwave.encryptionKey;
        
        if (!encryptionKey) {
            throw new Error('Flutterwave encryption key is not configured');
        }

        // Flutterwave expects the encryption key to be used for encrypting sensitive data
        // The SDK provides built-in encryption utilities
        const encrypted = flw.Encrypt.encryptData(data, encryptionKey);
        
        return encrypted;
    } catch (error) {
        console.error('Encryption error:', error);
        throw new Error('Failed to encrypt data');
    }
};

/**
 * Decrypt data using Flutterwave encryption key
 * Uses AES-256-CBC decryption as specified by Flutterwave
 */
export const decryptData = (encryptedData: string): string => {
    try {
        const encryptionKey = config.flutterwave.encryptionKey;
        
        if (!encryptionKey) {
            throw new Error('Flutterwave encryption key is not configured');
        }

        // Decrypt the data using Flutterwave's encryption key
        const decrypted = flw.Encrypt.decryptData(encryptedData, encryptionKey);
        
        return decrypted;
    } catch (error) {
        console.error('Decryption error:', error);
        throw new Error('Failed to decrypt data');
    }
};
