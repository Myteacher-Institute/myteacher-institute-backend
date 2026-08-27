import { Queue, Worker } from 'bullmq';
import type { Job } from 'bullmq';
import crypto from 'crypto';
import { isRedisAvailable, getRedisConnection } from '../config/redis';

export interface JobQueueHandle {
    add: (jobName: string, data: Record<string, unknown>) => Promise<{ id: string; queued: boolean }>;
    close: () => Promise<void>;
}

export interface JobWorkerHandle {
    close: () => Promise<void>;
}

/**
 * Producer side of the upload queue. When Redis is reachable this is a plain
 * BullMQ Queue — the heavy upload processing happens in a dedicated worker
 * process (see createJobWorker), so the API event loop is never blocked by
 * streaming files. Falls back to an in-process executor when Redis is down so
 * local development keeps working with a single process.
 */
export const createJobQueue = async <T>(
    name: string,
    processor: (data: T) => Promise<void>,
    opts: { concurrency?: number } = {}
): Promise<JobQueueHandle> => {
    const concurrency = opts.concurrency ?? 2;

    if (await isRedisAvailable()) {
        const connection = getRedisConnection();
        const queue = new Queue(name, { connection });

        return {
            add: async (jobName, data) => {
                const job = await queue.add(jobName, data as T, {
                    removeOnComplete: 100,
                    removeOnFail: 500,
                });
                const id = job.id ?? String(Date.now());
                console.log(`[${name}] 📤 Enqueued "${jobName}" job ${id}`);
                return { id, queued: true };
            },
            close: async () => {
                await queue.close();
            },
        };
    }

    // ── In-process fallback (Redis unavailable) ──────────────────────────────
    const pending: { jobId: string; data: T }[] = [];
    let running = 0;

    const pump = () => {
        while (running < concurrency && pending.length > 0) {
            const next = pending.shift();
            if (!next) break;
            running++;
            console.log(`[${name}] ⚙️ In-process executor processing job ${next.jobId}`);
            processor(next.data)
                .then(() => {
                    console.log(`[${name}] ✅ In-process job ${next.jobId} completed`);
                })
                .catch((err: unknown) => {
                    console.error(`[${name}] Job ${next.jobId} failed --->`, (err as Error)?.message ?? err);
                })
                .finally(() => {
                    running--;
                    pump();
                });
        }
    };

    return {
        add: async (jobName, data) => {
            const id = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
            pending.push({ jobId: `${jobName}:${id}`, data: data as T });
            console.log(`[${name}] 📤 Enqueued "${jobName}" job ${id} (in-process fallback)`);
            pump();
            return { id, queued: false };
        },
        close: async () => {
            /* nothing to close */
        },
    };
};

/**
 * Consumer side of the upload queue — intended to run in its own process so
 * streaming uploads never compete with the API event loop. Returns null when
 * Redis is unavailable: the producer's in-process executor already handles
 * those jobs, so the standalone worker process simply idles.
 */
export const createJobWorker = async <T>(
    name: string,
    processor: (data: T) => Promise<void>,
    opts: { concurrency?: number } = {}
): Promise<JobWorkerHandle | null> => {
    if (!(await isRedisAvailable())) {
        console.warn(`[${name}] Redis unavailable — in-process executor handles jobs; standalone worker skipped.`);
        return null;
    }

    const concurrency = opts.concurrency ?? 2;
    const connection = getRedisConnection();
    const worker = new Worker(
        name,
        async (job: Job<T>) => {
            console.log(`[${name}] 📥 Standalone worker picked up job ${job.id} (${job.name})`);
            await processor(job.data);
            console.log(`[${name}] ✅ Standalone worker completed job ${job.id}`);
        },
        { connection, concurrency }
    );

    worker.on('completed', (job) => {
        console.log(`[${name}] ✅ Job ${job.id} completed`);
    });
    worker.on('failed', (job, err) => {
        console.error(`[${name}] Job ${job?.id ?? 'unknown'} failed --->`, err?.message ?? err);
    });
    worker.on('error', (err) => {
        console.error(`[${name}] Worker error --->`, err?.message ?? err);
    });

    return {
        close: async () => {
            await worker.close();
        },
    };
};
