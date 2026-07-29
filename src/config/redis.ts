import { createClient, RedisClientType } from 'redis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

let redisClient: RedisClientType | null = null;
let redisAvailable = false;
let connectionAttempted = false;

export const getRedisClient = async (): Promise<RedisClientType> => {
  if (!redisClient && !connectionAttempted) {
    connectionAttempted = true;
    try {
      redisClient = createClient({
        url: redisUrl,
      });

      redisClient.on('error', (err) => {
        // Silently handle Redis errors - don't spam logs
        redisAvailable = false;
      });
      redisClient.on('connect', () => {
        console.log('🔴 Redis Client Connected');
        redisAvailable = true;
      });
      redisClient.on('disconnect', () => {
        redisAvailable = false;
      });

      await redisClient.connect();
    } catch (error) {
      // Silently fail - Redis is optional
      redisAvailable = false;
      redisClient = null;
    }
  }

  if (!redisClient) {
    throw new Error('Redis client not available');
  }

  return redisClient;
};

export const isRedisAvailable = (): boolean => redisAvailable;

export const closeRedisClient = async (): Promise<void> => {
  if (redisClient) {
    try {
      await redisClient.quit();
    } catch (error) {
      // Ignore close errors
    }
    redisClient = null;
    redisAvailable = false;
    connectionAttempted = false;
  }
};

// Cache helper functions - gracefully handle Redis unavailability
export const cacheSet = async (key: string, value: any, ttl: number = 3600): Promise<void> => {
  if (!redisAvailable) return;
  try {
    const client = await getRedisClient();
    await client.setEx(key, ttl, JSON.stringify(value));
  } catch (error) {
    // Silently fail - caching is optional
  }
};

export const cacheGet = async (key: string): Promise<any | null> => {
  if (!redisAvailable) return null;
  try {
    const client = await getRedisClient();
    const data = await client.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    // Silently fail - caching is optional
    return null;
  }
};

export const cacheDel = async (key: string): Promise<void> => {
  if (!redisAvailable) return;
  try {
    const client = await getRedisClient();
    await client.del(key);
  } catch (error) {
    // Silently fail - caching is optional
  }
};

export const cacheDelPattern = async (pattern: string): Promise<void> => {
  if (!redisAvailable) return;
  try {
    const client = await getRedisClient();
    const keys = await client.keys(pattern);
    if (keys.length > 0) {
      await client.del(keys);
    }
  } catch (error) {
    // Silently fail - caching is optional
  }
};
