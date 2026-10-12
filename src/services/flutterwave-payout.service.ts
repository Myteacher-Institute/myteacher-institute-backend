// Flutterwave Payout Service for affiliate withdrawals

interface FlutterwavePayoutResponse {
    status: string;
    message: string;
    data?: {
        id: number;
        reference: string;
        amount: number;
        currency: string;
        status: string;
        created_at: string;
        account_number: string;
        account_name: string;
        bank_name: string;
    };
}

interface FlutterwaveBank {
    id: number;
    code: string;
    name: string;
    country: string;
    currency: string;
    type: string;
    slug: string;
}

interface FlutterwaveBankListResponse {
    status: string;
    message: string;
    data: FlutterwaveBank[];
}

const createPayout = async (params: {
    account_bank: string;
    account_number: string;
    amount: number;
    currency: string;
    beneficiary_name: string;
    beneficiary_email?: string;
    reference: string;
    narration?: string;
}) => {
    try {
        const flutterwaveSecretKey = process.env.FLUTTERWAVE_SECRET_KEY;
        const flutterwaveBaseUrl = 'https://api.flutterwave.com/v3';

        const response = await fetch(`${flutterwaveBaseUrl}/transfers`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${flutterwaveSecretKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                ...params,
                // Add required Flutterwave transfer fields
                beneficiary: params.beneficiary_name,
                sender_name: 'MyTeacher Institute',
                transfer_type: 'nuban',
            }),
        });

        const data = await response.json() as FlutterwavePayoutResponse;

        if (data.status === 'success') {
            return {
                success: true,
                data: data.data,
                message: data.message
            };
        } else {
            return {
                success: false,
                message: data.message || 'Payout failed'
            };
        }
    } catch (error) {
        console.error('Flutterwave payout error:', error);
        return {
            success: false,
            message: 'Failed to process payout with Flutterwave'
        };
    }
};

// Verify payout status
const verifyPayout = async (reference: string) => {
    try {
        const flutterwaveSecretKey = process.env.FLUTTERWAVE_SECRET_KEY;
        const flutterwaveBaseUrl = 'https://api.flutterwave.com/v3';

        const response = await fetch(`${flutterwaveBaseUrl}/transfers/${reference}/verify`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${flutterwaveSecretKey}`,
            },
        });

        const data = await response.json() as FlutterwavePayoutResponse;

        if (data.status === 'success') {
            return {
                success: true,
                data: data.data,
                message: data.message
            };
        } else {
            return {
                success: false,
                message: data.message || 'Verification failed'
            };
        }
    } catch (error) {
        console.error('Flutterwave verification error:', error);
        return {
            success: false,
            message: 'Failed to verify payout'
        };
    }
};

// Get bank list from Flutterwave
const getBankList = async () => {
    try {
        const flutterwaveSecretKey = process.env.FLUTTERWAVE_SECRET_KEY;
        const flutterwaveBaseUrl = process.env.FLUTTERWAVE_URL || 'https://api.flutterwave.com/v3';

        const response = await fetch(`${flutterwaveBaseUrl}/banks/NG`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${flutterwaveSecretKey}`,
            },
        });

        const data = await response.json() as FlutterwaveBankListResponse;

        if (data.status === 'success') {
            return {
                success: true,
                data: data.data,
                message: data.message
            };
        } else {
            return {
                success: false,
                message: data.message || 'Failed to fetch bank list'
            };
        }
    } catch (error) {
        console.error('Flutterwave bank list error:', error);
        return {
            success: false,
            message: 'Failed to fetch bank list'
        };
    }
};

export { createPayout, verifyPayout, getBankList };
