import 'dotenv/config';

export const config = {
  port: Number(process.env.API_PORT ?? 4000),
  host: process.env.API_HOST ?? '0.0.0.0',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
  jwt: {
    secret: process.env.JWT_SECRET ?? 'change-me',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '24h',
    refreshExpiresIn: process.env.REFRESH_EXPIRES_IN ?? '7d',
  },
  bcrypt: { rounds: Number(process.env.BCRYPT_ROUNDS ?? 10) },
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  youtube: { apiKey: process.env.YOUTUBE_API_KEY ?? '' },
  n8n: {
    webhookUrl: process.env.N8N_ENRICH_WEBHOOK_URL ?? '',
    token: process.env.N8N_WEBHOOK_TOKEN ?? '',
  },
  webUrl: process.env.PUBLIC_WEB_URL ?? 'http://localhost:3000',
};
