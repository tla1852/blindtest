import Redis from 'ioredis';
import { config } from './config.js';

export const redis = new Redis(config.redisUrl, { maxRetriesPerRequest: null });
export const redisSub = new Redis(config.redisUrl, { maxRetriesPerRequest: null });

redis.on('error', (e) => console.error('[redis]', e.message));

// ===== Clés =====
export const k = {
  buzzQueue: (gameId: string, trackId: string) => `game:${gameId}:track:${trackId}:buzzes`,
  gameState: (gameId: string) => `game:${gameId}:state`,
  playerBuzzCount: (gameId: string, trackId: string, key: string) =>
    `game:${gameId}:track:${trackId}:buzzcount:${key}`,
  rateLogin: (ip: string) => `rl:login:${ip}`,
  rateImport: (userId: string) => `rl:import:${userId}`,
};
