import config from '../config/env';
import { FlutterwavePaymentResponse, FlutterwaveVerifyResponse } from '../types/transaction.type';
import Flutterwave from 'flutterwave-node-v3';

// Initialize Flutterwave instance
const flw = new Flutterwave(
    config.flutterwave.clientId || '',
    config.flutterwave.clientSecret || ''
);

/**
 * Create a payment link with Flutterwave using direct API call
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
        logo?: string;
    };
}): Promise<FlutterwavePaymentResponse> => {
    try {
        const payload = {
            tx_ref: params.tx_ref,
            amount: params.amount,
            currency: params.currency,
            redirect_url: params.redirect_url,
            payment_options: 'card,ussd,banktransfer', // Add payment options
            customer: params.customer,
            customizations: params.customizations || {
                title: 'Course Purchase',
                description: 'Purchase course on MyTeacher Institute'
            }
        };

        console.log('Flutterwave payment request payload:', payload);

        const response = await fetch('https://api.flutterwave.com/v3/payments', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.flutterwave.clientSecret}`
            },
            body: JSON.stringify(payload)
        });

        const data: any = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Failed to create payment link');
        }

        return {
            status: data.status || 'success',
            message: data.message || 'Payment link created successfully',
            data: {
                link: data.data?.link || '',
                redirect_url: data.data?.redirect_url || ''
            }
        };
    } catch (error) {
        throw error;
    }
};

/**
 * Verify a transaction with Flutterwave using SDK
 */
export const verifyTransaction = async (transactionId: string): Promise<FlutterwaveVerifyResponse> => {
    try {
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

        const encrypted = flw.Encrypt.encryptData(data, encryptionKey);
        
        return encrypted;
    } catch (error) {
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

        const decrypted = flw.Encrypt.decryptData(encryptedData, encryptionKey);
        
        return decrypted;
    } catch (error) {
        throw new Error('Failed to decrypt data');
    }
};
