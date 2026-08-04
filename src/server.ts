import createApp from './app';
import config from './config/env';
import { connectDB } from './config/database';
import { initializeSocket } from './config/socket';
import { createServer } from 'http';
import { startQueues } from './queues';

const startServer = async (): Promise<void> => {
    try {
        console.log('🚀 Starting MyTeacher Institute Backend...');
        console.log(`📍 Environment: ${config.nodeEnv}`);

        // Connect to MongoDB
        await connectDB();

        // Create Express app
        const app = createApp();

        // Create HTTP server for Socket.io
        const httpServer = createServer(app);

        // Initialize Socket.io
        initializeSocket(httpServer);

        // Initialize upload queues (BullMQ + Redis, or in-process fallback)
        await startQueues();

        // Add health check endpoint
        app.get('/health', (req, res) => {
            res.status(200).json({
                status: 'ok',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                environment: config.nodeEnv
            });
        });

        // Start HTTP server
        httpServer.listen(config.port, () => {
            console.log(`✓ Server running on http://localhost:${config.port}`);
            console.log(`📚 API ready for requests`);
            console.log(`🔌 Socket.io initialized`);
            console.log(`🔁 Upload queue ready`);
        });
    } catch (error) {
        console.error('✗ Failed to start server:', error);
        process.exit(1);
    }
};

startServer();
