import { Redis } from 'ioredis';

const redisUrl = process.env.REDIS_URL;

// Only create Redis client if REDIS_URL is configured
export const redis: Redis | null = redisUrl
  ? new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    })
  : null;

if (redis) {
  redis.on('error', (err: Error) => {
    console.error('Redis connection error:', err);
  });

  redis.on('connect', () => {
    console.log('Connected to Redis');
  });
} else {
  console.log('Redis not configured, caching disabled');
}

// Cache helper functions (no-op if Redis not configured)
export async function getCache<T>(key: string): Promise<T | null> {
  if (!redis) return null;
  const cached = await redis.get(key);
  if (!cached) return null;
  return JSON.parse(cached) as T;
}

export async function setCache<T>(
  key: string,
  value: T,
  ttlSeconds = 300
): Promise<void> {
  if (!redis) return;
  await redis.setex(key, ttlSeconds, JSON.stringify(value));
}

export async function deleteCache(key: string): Promise<void> {
  if (!redis) return;
  await redis.del(key);
}

export async function deleteCachePattern(pattern: string): Promise<void> {
  if (!redis) return;
  const keys = await redis.keys(pattern);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}

export default redis;
