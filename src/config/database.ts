import mongoose from 'mongoose';
import config from './env';

// Connection state tracking
let isConnected = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY_MS = 5000;

// Connection event listeners
mongoose.connection.on('connected', async () => {
    console.log('✓ MongoDB connected successfully');
    isConnected = true;
    reconnectAttempts = 0;

    // Drop the old partial unique index that was removed from the schema.
    // This is safe to call — it silently no-ops if the index no longer exists.
    try {
        await mongoose.connection.collection('mentorshiprequests').dropIndex('studentId_1_selectedMentor_1');
        console.log('✓ Dropped stale studentId_1_selectedMentor_1 index');
    } catch {
        // index already gone — nothing to do
    }
});

mongoose.connection.on('error', (err) => {
    console.error('✗ MongoDB connection error:', err);
    isConnected = false;
});

mongoose.connection.on('disconnected', () => {
    console.log('⚠ MongoDB disconnected');
    isConnected = false;
});

mongoose.connection.on('reconnected', () => {
    console.log('✓ MongoDB reconnected');
    isConnected = true;
    reconnectAttempts = 0;
});

export const connectDB = async (): Promise<void> => {
    try {
        // Configure mongoose for auto-reconnection
        mongoose.set('autoIndex', true);
        mongoose.set('bufferCommands', true);

        await mongoose.connect(config.mongodb.uri, {
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 45000,
            maxPoolSize: 10,
            minPoolSize: 2,
            maxIdleTimeMS: 30000,
            retryWrites: true,
            retryReads: true,
        });

        isConnected = true;
    } catch (error) {
        console.error('✗ MongoDB connection failed:', error);
        isConnected = false;

        // Implement retry logic for initial connection
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts++;
            console.log(`🔄 Retrying connection (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}) in ${RECONNECT_DELAY_MS}ms...`);
            
            await new Promise(resolve => setTimeout(resolve, RECONNECT_DELAY_MS));
            return connectDB();
        } else {
            console.error('✗ Max reconnection attempts reached. Exiting...');
            process.exit(1);
        }
    }
};

export const disconnectDB = async (): Promise<void> => {
    try {
        await mongoose.disconnect();
        console.log('✓ MongoDB disconnected');
        isConnected = false;
    } catch (error) {
        console.error('✗ Error disconnecting MongoDB:', error);
    }
};

// Graceful shutdown handler
export const handleShutdown = async (signal: string): Promise<void> => {
    console.log(`\n🛑 ${signal} received. Starting graceful shutdown...`);
    
    try {
        await disconnectDB();
        console.log('✓ Graceful shutdown completed');
        process.exit(0);
    } catch (error) {
        console.error('✗ Error during shutdown:', error);
        process.exit(1);
    }
};

// Register shutdown handlers
process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

export default { connectDB, disconnectDB, handleShutdown };
