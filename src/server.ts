import createApp from './app';
import config from './config/env';
import { connectDB } from './config/database';
import { createServer } from 'http';
import { initializeSocket } from './config/socket';

const startServer = async (): Promise<void> => {
    try {
        console.log('🚀 Starting MyTeacher Institute Backend...');
        console.log(`📍 Environment: ${config.nodeEnv}`);

        // Connect to MongoDB
        await connectDB();

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
        });
    } catch (error) {
        console.error('✗ Failed to start server:', error);
        process.exit(1);
    }
};

startServer();
