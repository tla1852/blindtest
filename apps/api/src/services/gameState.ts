import { prisma } from '../db.js';
import { redis, k } from '../redis.js';

export type BuzzEntry = {
  playerId: string;
  pseudo: string;
  teamId: string | null;
  teamName: string | null;
  teamColor: string | null;
  timestampClient: number;
  timestampServer: number;
  rank: number;
  validated: boolean | null;
};

export async function getBuzzQueue(gameId: string, trackId: string): Promise<BuzzEntry[]> {
  const raw = await redis.zrange(k.buzzQueue(gameId, trackId), 0, -1);
  return raw.map((s) => JSON.parse(s) as BuzzEntry);
}

export async function addBuzz(
  gameId: string,
  trackId: string,
  entry: Omit<BuzzEntry, 'rank'>
): Promise<BuzzEntry> {
  const rank = await redis.zcard(k.buzzQueue(gameId, trackId));
  const full: BuzzEntry = { ...entry, rank: rank + 1 };
  await redis.zadd(k.buzzQueue(gameId, trackId), entry.timestampServer, JSON.stringify(full));
  return full;
}

export async function resetTrackState(gameId: string, trackId: string) {
  await redis.del(k.buzzQueue(gameId, trackId));
  // Reset compteurs de buzz par joueur/équipe de ce track
  const keys = await redis.keys(`game:${gameId}:track:${trackId}:buzzcount:*`);
  if (keys.length) await redis.del(...keys);
}

export async function incrementBuzzCount(gameId: string, trackId: string, key: string): Promise<number> {
  return redis.incr(k.playerBuzzCount(gameId, trackId, key));
}

export async function canBuzz(gameId: string, trackId: string, playerId: string, teamId: string | null, buzzersPerTeam: number) {
  // Un device ne peut buzzer qu'une seule fois par manche
  const playerCount = Number((await redis.get(k.playerBuzzCount(gameId, trackId, `p:${playerId}`))) ?? 0);
  if (playerCount >= 1) return { ok: false, reason: 'already-buzzed' as const };
  if (teamId) {
    const teamCount = Number((await redis.get(k.playerBuzzCount(gameId, trackId, `t:${teamId}`))) ?? 0);
    if (teamCount >= buzzersPerTeam) return { ok: false, reason: 'team-limit' as const };
  }
  return { ok: true as const };
}

export async function persistBuzz(entry: BuzzEntry, gameId: string, trackId: string) {
  await prisma.buzz.create({
    data: {
      gameId,
      trackId,
      playerId: entry.playerId,
      timestampClient: BigInt(entry.timestampClient),
      timestampServer: BigInt(entry.timestampServer),
      rank: entry.rank,
      validated: entry.validated,
    },
  });
}
