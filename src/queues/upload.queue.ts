import { Queue, Worker } from 'bullmq';
import type { Job } from 'bullmq';
import crypto from 'crypto';
import { isRedisAvailable, getRedisConnection } from '../config/redis';

export interface JobQueueHandle {
    add: (jobName: string, data: Record<string, unknown>) => Promise<{ id: string; queued: boolean }>;
    close: () => Promise<void>;
}

/**
 * Create a job queue backed by BullMQ + Redis when Redis is reachable.
 * Falls back to a simple in-process executor so local development (and
 * deployments without Redis) keep working unchanged.
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
        const worker = new Worker(
            name,
            async (job: Job<T>) => {
                await processor(job.data);
            },
            { connection, concurrency }
        );

        worker.on('failed', (job, err) => {
            console.error(`[${name}] Job ${job?.id ?? 'unknown'} failed --->`, err?.message ?? err);
        });
        worker.on('error', (err) => {
            console.error(`[${name}] Worker error --->`, err?.message ?? err);
        });

        return {
            add: async (jobName, data) => {
                const job = await queue.add(jobName, data as T, {
                    removeOnComplete: 100,
                    removeOnFail: 500,
                });
                return { id: job.id ?? String(Date.now()), queued: true };
            },
            close: async () => {
                await worker.close();
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
            processor(next.data)
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
            pump();
            return { id, queued: false };
        },
        close: async () => {
            /* nothing to close */
        },
    };
};
