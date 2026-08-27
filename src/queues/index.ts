import { createJobQueue, createJobWorker, type JobQueueHandle, type JobWorkerHandle } from './upload.queue';
import { processYouTubeUpload } from '../workers/youtube-upload.worker';
import { processDriveUpload } from '../workers/drive-upload.worker';
import type { YouTubeUploadJob, DriveUploadJob } from './types';

let youtubeQueue: JobQueueHandle | null = null;
let driveQueue: JobQueueHandle | null = null;
let workersStarted = false;

/**
 * Initialize the upload queue producers (YouTube + Drive).
 *
 * Both the API server and the standalone queue worker process call this so
 * that every process can enqueue new upload jobs — in particular the worker
 * re-queues the unfinished uploads of a course-creation job it resumes.
 */
export const initQueueProducers = async (): Promise<void> => {
    youtubeQueue = await createJobQueue<YouTubeUploadJob>('youtube-uploads', processYouTubeUpload, { concurrency: 2 });
    driveQueue = await createJobQueue<DriveUploadJob>('drive-uploads', processDriveUpload, { concurrency: 2 });
};

/**
 * Initialize both upload queues as producers.
 *
 * By default the upload workers also run in-process (unchanged single-process
 * behavior). Set QUEUE_WORKER_EXTERNAL=true on the API server and run
 * `npm run worker` in a separate process to move the heavy streaming uploads
 * off the API event loop entirely.
 */
export const startQueues = async (): Promise<void> => {
    await initQueueProducers();

    if (process.env.QUEUE_WORKER_EXTERNAL !== 'true') {
        await startWorkers();
    } else {
        console.log('🔁 QUEUE_WORKER_EXTERNAL=true — uploads are processed by the standalone queue worker process.');
    }
};

/**
 * Start the upload workers (BullMQ consumers). Called in-process by
 * startQueues for single-process mode, and from the standalone worker process.
 */
export const startWorkers = async (): Promise<void> => {
    if (workersStarted) return;
    workersStarted = true;

    await createJobWorker<YouTubeUploadJob>('youtube-uploads', processYouTubeUpload, { concurrency: 2 });
    await createJobWorker<DriveUploadJob>('drive-uploads', processDriveUpload, { concurrency: 2 });
};

export const enqueueYouTubeUpload = (data: YouTubeUploadJob): Promise<{ id: string; queued: boolean }> => {
    if (!youtubeQueue) {
        return Promise.reject(new Error('YouTube upload queue is not initialized'));
    }
    return youtubeQueue.add('youtube-upload', data as unknown as Record<string, unknown>);
};

export const enqueueDriveUpload = (data: DriveUploadJob): Promise<{ id: string; queued: boolean }> => {
    if (!driveQueue) {
        return Promise.reject(new Error('Drive upload queue is not initialized'));
    }
    return driveQueue.add('drive-upload', data as unknown as Record<string, unknown>);
};

export type { JobQueueHandle, JobWorkerHandle };
