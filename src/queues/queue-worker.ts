process.env.QUEUE_WORKER = 'true';

import { connectDB } from '../config/database';
import { initQueueProducers, startWorkers } from './index';
import { resumeInterruptedCourseCreations } from '../services/course-creation.service';

/**
 * Standalone queue worker process.
 *
 * Consumes YouTube/Drive upload jobs from Redis and drives the resumable
 * course-creation pipeline, so the heavy streaming uploads never occupy the
 * API server's event loop. Progress/socket events are relayed to the API
 * process through Redis pub/sub (see config/redis.ts + config/socket.ts).
 *
 * Run with: `npm run worker`
 */
const startWorker = async (): Promise<void> => {
    console.log('🚀 Starting Queue Worker process...');

    await connectDB();
    await initQueueProducers();
    await startWorkers();
    await resumeInterruptedCourseCreations();

    console.log('🔁 Upload queue ready');
};

startWorker().catch((error) => {
    console.error('✗ Failed to start queue worker:', error);
    process.exit(1);
});
