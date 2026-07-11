import { env } from './env.js';

export function getRedisConnection() {
  if (!env.redisUrl) return null;

  const useTls = env.redisUrl.startsWith('rediss://');
  return {
    url: env.redisUrl,
    maxRetriesPerRequest: null,
    ...(useTls ? { tls: {} } : {}),
  };
}

export function isRedisConfigured() {
  return Boolean(env.redisUrl);
}
