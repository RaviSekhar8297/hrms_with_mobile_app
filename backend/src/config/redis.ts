import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const redisHost = process.env.REDIS_HOST || '127.0.0.1';
const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);
const redisPassword = process.env.REDIS_PASSWORD || undefined;

let isRedisConnected = false;

export const redisClient = new Redis({
  host: redisHost,
  port: redisPort,
  password: redisPassword,
  lazyConnect: true,
  maxRetriesPerRequest: 1,
  retryStrategy(times) {
    if (times > 3) {
      console.warn('⚠️ Redis connection attempts exceeded. Operating in Fail-Safe DB-only mode.');
      return null; // Stop retrying automatically
    }
    return Math.min(times * 200, 1000);
  },
});

redisClient.on('connect', () => {
  isRedisConnected = true;
  console.log(`✅ Connected to Redis cache service at ${redisHost}:${redisPort}`);
});

redisClient.on('error', (err) => {
  isRedisConnected = false;
  // Silent log warning to prevent crashing the Express server
  console.warn(`⚠️ Redis Cache notice: ${err.message}`);
});

// Attempt connection asynchronously on boot
redisClient.connect().catch(() => {
  console.warn('⚠️ Initial Redis connection failed. App running with direct DB queries fallback.');
});

/**
 * Get cached JSON value or null if unavailable/expired
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!isRedisConnected) return null;
  try {
    const data = await redisClient.get(key);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    return null;
  }
}

/**
 * Set JSON cache with Time-To-Live (TTL in seconds)
 */
export async function cacheSet(key: string, value: unknown, ttlSeconds = 300): Promise<void> {
  if (!isRedisConnected) return;
  try {
    await redisClient.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch (err) {
    // Ignore cache set errors
  }
}

/**
 * Delete cache key or pattern
 */
export async function cacheDel(key: string): Promise<void> {
  if (!isRedisConnected) return;
  try {
    await redisClient.del(key);
  } catch (err) {
    // Ignore cache del errors
  }
}

export function isRedisAvailable(): boolean {
  return isRedisConnected;
}

export default redisClient;
