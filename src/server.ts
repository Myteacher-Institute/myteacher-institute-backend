import createApp from './app';
import { connectDB } from './config/database';
import config from './config/env';


const startServer = async (): Promise<void> => {
    try {
        console.log('🚀 Starting MyTeacher Institute Backend...');
        console.log(`📍 Environment: ${config.nodeEnv}`);

        // Connect to MongoDB
        await connectDB();

        // Create Express app
        const app = createApp();

        // Mount Scalar API docs
        

        // Start Express server
        app.listen(config.port, () => {
            console.log(`✓ Server running on http://localhost:${config.port}`);
            console.log(`📚 API ready for requests`);
        });
    } catch (error) {
        console.error('✗ Failed to start server:', error);
        process.exit(1);
    }
};

startServer();
