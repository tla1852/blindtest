import { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../db.js';
import { config } from '../config.js';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const registerSchema = loginSchema.extend({
  displayName: z.string().min(2).max(60),
});

export async function registerAuthRoutes(app: FastifyInstance) {
  // Rate limit : 5 tentatives / 15 min / IP (CDC §9.2)
  app.post('/login', {
    config: { rateLimit: { max: 5, timeWindow: '15 minutes' } },
  }, async (req, reply) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid payload' });

    const { email, password } = parsed.data;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return reply.code(401).send({ error: 'Invalid credentials' });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return reply.code(401).send({ error: 'Invalid credentials' });

    const token = app.jwt.sign(
      { sub: user.id, email: user.email, displayName: user.displayName },
      { expiresIn: config.jwt.expiresIn }
    );
    const refreshToken = app.jwt.sign(
      { sub: user.id, type: 'refresh' },
      { expiresIn: config.jwt.refreshExpiresIn }
    );

    return { token, refreshToken, user: { id: user.id, email: user.email, displayName: user.displayName } };
  });

  app.post('/register', async (req, reply) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid payload' });

    const { email, password, displayName } = parsed.data;
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) return reply.code(409).send({ error: 'Email already in use' });

    const passwordHash = await bcrypt.hash(password, config.bcrypt.rounds);
    const user = await prisma.user.create({ data: { email, passwordHash, displayName } });

    return { id: user.id, email: user.email, displayName: user.displayName };
  });

  app.get('/me', { preHandler: [app.authenticate] }, async (req) => {
    const payload = req.user as { sub: string; email: string; displayName: string };
    return payload;
  });

}
