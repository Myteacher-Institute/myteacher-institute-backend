import createApp from './app';
import config from './config/env';
import { connectDB } from './config/database';
import { createServer } from 'http';
import { initializeSocket } from './config/socket';
import { getRedisClient, closeRedisClient, isRedisAvailable } from './config/redis';

const startServer = async (): Promise<void> => {
    try {
        console.log('🚀 Starting MyTeacher Institute Backend...');
        console.log(`📍 Environment: ${config.nodeEnv}`);

        // Connect to MongoDB
        await connectDB();

        // Connect to Redis (optional - don't fail if unavailable)
        try {
            await getRedisClient();
        } catch (error) {
            console.warn('⚠️ Redis connection failed - caching will be disabled');
        }

        // Create Express app
        const app = createApp();

        // Create HTTP server
        const httpServer = createServer(app);

        // Initialize Socket.io
        initializeSocket(httpServer);

        // Start HTTP server
        httpServer.listen(config.port, () => {
            console.log(`✓ Server running on http://localhost:${config.port}`);
            console.log(`📚 API ready for requests`);
            console.log(`🔌 Socket.io server ready for connections`);
            if (isRedisAvailable()) {
                console.log(`🔴 Redis cache connected`);
            } else {
                console.log(`⚠️ Redis cache unavailable - running without caching`);
            }
        });

        // Graceful shutdown
        const gracefulShutdown = async (): Promise<void> => {
            console.log('🛑 Shutting down gracefully...');
            await closeRedisClient();
            process.exit(0);
        };

        process.on('SIGTERM', gracefulShutdown);
        process.on('SIGINT', gracefulShutdown);
    } catch (error) {
        console.error('✗ Failed to start server:', error);
        process.exit(1);
    }
};

startServer();
