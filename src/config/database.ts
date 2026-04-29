import mongoose from 'mongoose';
import config from './env';

export const connectDB = async (): Promise<void> => {
    try {
        await mongoose.connect(config.mongodb.uri);
        console.log('✓ MongoDB connected successfully');
    } catch (error) {
        console.error('✗ MongoDB connection failed:', error);
        process.exit(1);
    }
};

export const disconnectDB = async (): Promise<void> => {
    try {
        await mongoose.disconnect();
        console.log('✓ MongoDB disconnected');
    } catch (error) {
        console.error('✗ Error disconnecting MongoDB:', error);
    }
};

export default { connectDB, disconnectDB };
