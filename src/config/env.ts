import dotenv from 'dotenv';

dotenv.config();

export const config = {
    port: parseInt(process.env.PORT || '4000', 10),
    nodeEnv: (process.env.NODE_ENV || 'development') as 'development' | 'production' | 'test',
    mongodb: {
        uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/myteacher-institute',
    },
    JWT_REFRESH_TOKEN_SECRET: process.env.JWT_REFRESH_TOKEN_SECRET,
    JWT_ACCESS_TOKEN_SECRET: process.env.JWT_ACCESS_TOKEN_SECRET,
    REFRESH_TOKEN_COOKIE_NAME: process.env.REFRESH_TOKEN_COOKIE_NAME,
    BACKEND_BASE_URL: process.env.BACKEND_BASE_URL ?? 'http://localhost:4000',
    flutterwave: {
        clientId: process.env.FLUTTERWAVE_CLIENT_ID,
        clientSecret: process.env.FLUTTERWAVE_CLIENT_SECRET,
        encryptionKey: process.env.FLUTTERWAVE_ENCRYPTION_KEY
    }
};

export default config;
