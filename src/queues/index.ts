import { createJobQueue, type JobQueueHandle } from './upload.queue';
import { processYouTubeUpload } from '../workers/youtube-upload.worker';
import { processDriveUpload } from '../workers/drive-upload.worker';
import type { YouTubeUploadJob, DriveUploadJob } from './types';

let youtubeQueue: JobQueueHandle | null = null;
let driveQueue: JobQueueHandle | null = null;

/**
 * Initialize both upload queues. Falls back to in-process execution when
 * Redis is unreachable, so the app keeps working in local development.
 */
export const startQueues = async (): Promise<void> => {
    youtubeQueue = await createJobQueue<YouTubeUploadJob>('youtube-uploads', processYouTubeUpload, { concurrency: 2 });
    driveQueue = await createJobQueue<DriveUploadJob>('drive-uploads', processDriveUpload, { concurrency: 2 });
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
