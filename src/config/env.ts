import dotenv from 'dotenv';

dotenv.config();

export const config = {
    port: parseInt(process.env.PORT || '5000', 10),
    nodeEnv: (process.env.NODE_ENV || 'development') as 'development' | 'production' | 'test',
    mongodb: {
        uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/myteacher-institute',
    },
};

export default config;
