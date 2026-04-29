import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';

const createSchema = z.object({
  playlistId: z.string(),
  mode: z.enum(['FFA', 'TDM']),
  maxTeams: z.number().int().min(2).max(8).optional(),
  buzzersPerTeam: z.number().int().min(1).max(40).optional(),
  delayBeforeBuzz: z.number().int().min(0).max(60).optional(),
  teams: z.array(z.object({ name: z.string(), color: z.string() })).optional(),
});

const TEAM_COLORS = ['#A855F7', '#F472B6', '#38BDF8', '#FBBF24', '#10B981', '#EF4444', '#F97316', '#8B5CF6'];

export async function registerGameRoutes(app: FastifyInstance) {
  // POST /api/games — créer une partie (auth requise)
  app.post('/', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = (req.user as any).sub as string;
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid payload', details: parsed.error.issues });

    const { playlistId, mode, maxTeams = 8, buzzersPerTeam = 2, delayBeforeBuzz = 0, teams } = parsed.data;
    const playlist = await prisma.playlist.findFirst({ where: { id: playlistId, userId } });
    if (!playlist) return reply.code(404).send({ error: 'Playlist not found' });

    const game = await prisma.game.create({
      data: {
        userId,
        playlistId,
        mode,
        maxTeams,
        buzzersPerTeam,
        delayBeforeBuzz,
        teams: mode === 'TDM'
          ? { create: (teams ?? defaultTeams(maxTeams)) }
          : undefined,
      },
      include: { teams: true },
    });

    return game;
  });

  // GET /api/games (auth) — parties de l'animateur
  app.get('/', { preHandler: [app.authenticate] }, async (req) => {
    const userId = (req.user as any).sub as string;
    return prisma.game.findMany({
      where: { userId },
      include: { playlist: { select: { name: true } }, _count: { select: { players: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  });

  // GET /api/games/:id — détails de partie (public, utilisé par animateur + display + participants)
  app.get('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const game = await prisma.game.findUnique({
      where: { id },
      include: {
        teams: true,
        players: { include: { team: true } },
        playlist: {
          include: {
            tracks: {
              orderBy: { position: 'asc' },
              include: { hints: { orderBy: { hintOrder: 'asc' } } },
            },
          },
        },
      },
    });
    if (!game) return reply.code(404).send({ error: 'Not found' });
    return game;
  });

  // DELETE /api/games/:id — supprimer une partie (auth, owner only)
  app.delete('/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = (req.user as any).sub as string;
    const { id } = req.params as { id: string };
    const game = await prisma.game.findFirst({ where: { id, userId } });
    if (!game) return reply.code(404).send({ error: 'Not found' });
    await prisma.game.delete({ where: { id } });
    return { ok: true };
  });

  // GET /api/games/:id/scores — classement
  app.get('/:id/scores', async (req) => {
    const { id } = req.params as { id: string };
    const scores = await prisma.score.findMany({
      where: { gameId: id },
      include: { team: true, player: true },
    });

    const byTeam = new Map<string, { teamId: string; name: string; color: string; points: number }>();
    const byPlayer = new Map<string, { playerId: string; pseudo: string; points: number }>();

    for (const s of scores) {
      const total = s.points + s.bonusPoints;
      if (s.team) {
        const e = byTeam.get(s.teamId!) ?? { teamId: s.teamId!, name: s.team.name, color: s.team.color, points: 0 };
        e.points += total;
        byTeam.set(s.teamId!, e);
      }
      if (s.player) {
        const e = byPlayer.get(s.playerId!) ?? { playerId: s.playerId!, pseudo: s.player.pseudo, points: 0 };
        e.points += total;
        byPlayer.set(s.playerId!, e);
      }
    }

    return {
      teams: [...byTeam.values()].sort((a, b) => b.points - a.points),
      players: [...byPlayer.values()].sort((a, b) => b.points - a.points),
    };
  });
}

function defaultTeams(n: number) {
  return Array.from({ length: Math.min(n, TEAM_COLORS.length) }, (_, i) => ({
    name: `Équipe ${i + 1}`,
    color: TEAM_COLORS[i],
  }));
}
