import { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';

export async function registerStatsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  // Statistiques complètes d'une partie (CDC §8)
  app.get('/game/:id', async (req, reply) => {
    const userId = (req.user as any).sub as string;
    const { id } = req.params as { id: string };

    const game = await prisma.game.findFirst({ where: { id, userId }, include: { players: true, teams: true } });
    if (!game) return reply.code(404).send({ error: 'Not found' });

    const buzzes = await prisma.buzz.findMany({ where: { gameId: id } });
    const scores = await prisma.score.findMany({ where: { gameId: id } });

    const perPlayer = new Map<string, {
      playerId: string;
      pseudo: string;
      totalBuzz: number;
      correct: number;
      notInterrogated: number;
      totalPoints: number;
      avgReactionMs: number;
      reactionTimes: number[];
    }>();

    for (const p of game.players) {
      perPlayer.set(p.id, {
        playerId: p.id,
        pseudo: p.pseudo,
        totalBuzz: 0,
        correct: 0,
        notInterrogated: 0,
        totalPoints: 0,
        avgReactionMs: 0,
        reactionTimes: [],
      });
    }

    for (const b of buzzes) {
      const e = perPlayer.get(b.playerId);
      if (!e) continue;
      e.totalBuzz += 1;
      if (b.validated === true) e.correct += 1;
      if (b.validated === null) e.notInterrogated += 1;
      // reactionTime = timestampClient (pris à la diff depuis track:play côté client)
      e.reactionTimes.push(Number(b.timestampClient));
    }

    for (const s of scores) {
      if (s.playerId) {
        const e = perPlayer.get(s.playerId);
        if (e) e.totalPoints += s.points + s.bonusPoints;
      }
    }

    for (const e of perPlayer.values()) {
      e.avgReactionMs = e.reactionTimes.length
        ? Math.round(e.reactionTimes.reduce((a, b) => a + b, 0) / e.reactionTimes.length)
        : 0;
    }

    return {
      gameId: id,
      mode: game.mode,
      status: game.status,
      startedAt: game.startedAt,
      finishedAt: game.finishedAt,
      players: [...perPlayer.values()].map(({ reactionTimes, ...rest }) => ({
        ...rest,
        buzzHitRate: rest.totalBuzz ? rest.correct / rest.totalBuzz : 0,
        buzzMissRate: rest.totalBuzz ? rest.notInterrogated / rest.totalBuzz : 0,
      })),
    };
  });
}
