import IORedis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

let connection: IORedis | null = null;
let availabilityProbed = false;
let redisAvailable = false;

// Cache helpers use their own connection so GET/SET/DEL/SCAN keep working even
// when the local Redis is too old for BullMQ (>= 5.0 required). Best-effort:
// if Redis is unreachable the helpers silently fall back to the database.
let cacheConnection: IORedis | null = null;
let cacheProbed = false;

/**
 * Establish a persistent connection for the cache helpers. Probes once so we
 * never hammer a down Redis; the connection auto-reconnects if it drops later.
 */
const ensureCacheConnection = async (): Promise<IORedis | null> => {
    if (cacheConnection) return cacheConnection;
    if (cacheProbed) return null;
    cacheProbed = true;

    const conn = new IORedis(REDIS_URL, {
        lazyConnect: true,
        connectTimeout: 1500,
        enableOfflineQueue: false,
        maxRetriesPerRequest: 1,
        retryStrategy: (times) => (times > 2 ? null : 250),
    });

    try {
        await conn.connect();
        await conn.ping();
        cacheConnection = conn;
        return conn;
    } catch {
        cacheConnection = null;
        return null;
    }
};

/**
 * Probe Redis once with a short timeout so server startup isn't blocked.
 * Non-fatal — if Redis is down OR too old for BullMQ we fall back to an
 * in-process queue. BullMQ requires Redis >= 5.0. Cache helpers work on any
 * reachable Redis, so this also warms the cache connection.
 */
export const isRedisAvailable = async (): Promise<boolean> => {
    if (availabilityProbed) return redisAvailable;
    availabilityProbed = true;

    const cacheConn = await ensureCacheConnection();
    if (!cacheConn) {
        redisAvailable = false;
        return redisAvailable;
    }

    try {
        const info = (await cacheConn.info('server')) as string;
        const versionMatch = info.match(/redis_version:([\d.]+)/);
        const version = versionMatch ? versionMatch[1] : '0';
        const major = parseInt(version.split('.')[0] || '0', 10);
        redisAvailable = major >= 5;
        if (!redisAvailable) {
            console.warn(`[redis] Redis ${version} detected — BullMQ requires >= 5.0. Falling back to in-process queue. Cache helpers enabled.`);
        }
    } catch {
        redisAvailable = false;
    }

    return redisAvailable;
};

/**
 * Shared BullMQ connection. `maxRetriesPerRequest: null` is required by BullMQ.
 */
export const getRedisConnection = (): IORedis => {
    if (!connection) {
        connection = new IORedis(REDIS_URL, {
            maxRetriesPerRequest: null,
            enableReadyCheck: false,
            retryStrategy: (times) => Math.min(times * 200, 5000),
        });
    }
    return connection;
};

// ── Cache helpers (gracefully no-op when Redis is unavailable) ──────────────

export const cacheGet = async (key: string): Promise<any | null> => {
    const conn = await ensureCacheConnection();
    if (!conn) return null;
    try {
        const data = await conn.get(key);
        if (data == null) return null;
        try { return JSON.parse(data); } catch { return data; }
    } catch (error) {
        console.error('[redis] cacheGet error --->', (error as Error)?.message ?? error);
        return null;
    }
};

export const cacheSet = async (key: string, value: unknown, ttl: number = 3600): Promise<void> => {
    const conn = await ensureCacheConnection();
    if (!conn) return;
    try {
        await conn.set(key, JSON.stringify(value), 'EX', ttl);
    } catch (error) {
        console.error('[redis] cacheSet error --->', (error as Error)?.message ?? error);
    }
};

export const cacheDelPattern = async (pattern: string): Promise<void> => {
    const conn = await ensureCacheConnection();
    if (!conn) return;
    try {
        const stream = conn.scanStream({ match: pattern, count: 100 });
        const keys: string[] = [];
        await new Promise<void>((resolve, reject) => {
            stream.on('data', (chunk: string[]) => { for (const k of chunk) keys.push(k); });
            stream.on('end', () => resolve());
            stream.on('error', (err) => reject(err));
        });
        if (keys.length > 0) {
            await conn.del(...keys);
        }
    } catch (error) {
        console.error('[redis] cacheDelPattern error --->', (error as Error)?.message ?? error);
    }
};

export const REDIS_URL_STR = REDIS_URL;
