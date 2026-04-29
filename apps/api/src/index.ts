import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import { Server as IOServer } from 'socket.io';
import { config } from './config.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerPlaylistRoutes } from './routes/playlists.js';
import { registerGameRoutes } from './routes/games.js';
import { registerImportRoutes } from './routes/import.js';
import { registerStatsRoutes } from './routes/stats.js';
import { registerSocketHandlers } from './ws/socket.js';
import { authPlugin } from './middleware/auth.js';

async function main() {
  const app = Fastify({ logger: { level: 'info' } });

  await app.register(cors, { origin: config.corsOrigin.split(','), credentials: true });
  await app.register(jwt, { secret: config.jwt.secret });
  await app.register(rateLimit, { global: false });
  await app.register(authPlugin);

  app.get('/health', async () => ({ ok: true, version: '0.1.0' }));

  // Filet de sécurité : certains proxys (Next.js en particulier) normalisent
  // les trailing slashes et peuvent faire arriver la requête de polling comme
  // `/socket.io?EIO=4...` au lieu de `/socket.io/?EIO=4...`. Dans ce cas,
  // engine.io ne l'intercepte pas et Fastify répondrait 404. On redirige.
  app.get('/socket.io', async (req, reply) => {
    const qs = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
    return reply.redirect(307, `/socket.io/${qs}`);
  });

  await app.register(registerAuthRoutes, { prefix: '/api/auth' });
  await app.register(registerPlaylistRoutes, { prefix: '/api/playlists' });
  await app.register(registerGameRoutes, { prefix: '/api/games' });
  await app.register(registerImportRoutes, { prefix: '/api/import' });
  await app.register(registerStatsRoutes, { prefix: '/api/stats' });

  // IMPORTANT : attacher Socket.io au serveur HTTP AVANT app.listen().
  // Sinon Fastify répond déjà aux requêtes /socket.io/ avec un 404 avant
  // que engine.io puisse les intercepter.
  await app.ready();
  const io = new IOServer(app.server, {
    cors: { origin: config.corsOrigin.split(','), credentials: true },
    transports: ['websocket', 'polling'],
  });
  registerSocketHandlers(io);
  app.log.info('🛰️  Socket.io attached');

  await app.listen({ host: config.host, port: config.port });
  app.log.info(`🎮 RetroBuzz API ready on http://${config.host}:${config.port}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
