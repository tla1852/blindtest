import { Server as IOServer, Socket } from 'socket.io';
import { prisma } from '../db.js';
import { addBuzz, canBuzz, getBuzzQueue, incrementBuzzCount, resetTrackState, persistBuzz } from '../services/gameState.js';

// ===================================================================
// Handlers Socket.io — implémente les 13 événements du CDC §5.1
// ===================================================================

const room = {
  game: (id: string) => `game:${id}`,
  admin: (id: string) => `admin:${id}`,
  display: (id: string) => `display:${id}`,
};

async function isGameFinished(gameId: string): Promise<boolean> {
  const g = await prisma.game.findUnique({ where: { id: gameId }, select: { status: true } });
  return g?.status === 'finished';
}

export function registerSocketHandlers(io: IOServer) {
  io.on('connection', (socket: Socket) => {
    socket.data = {};
    console.log('[ws] client connected', socket.id);
    socket.on('disconnect', (reason: string) => {
      console.log('[ws] client disconnected', socket.id, 'reason:', reason);
    });

    // ===== JOIN (admin, display, player) =====
    socket.on('admin:join', async ({ gameId }: { gameId: string }) => {
      socket.join(room.game(gameId));
      socket.join(room.admin(gameId));
      socket.data.gameId = gameId;
      socket.data.role = 'admin';
    });

    socket.on('display:join', ({ gameId }: { gameId: string }) => {
      socket.join(room.game(gameId));
      socket.join(room.display(gameId));
      socket.data.gameId = gameId;
      socket.data.role = 'display';
    });

    // Participant join
    socket.on('player:join', async ({ gameId, pseudo, teamId, deviceFingerprint }: any, cb?: Function) => {
      console.log('[ws] player:join', { gameId, pseudo, teamId, sid: socket.id });
      try {
        const game = await prisma.game.findUnique({ where: { id: gameId }, include: { players: true } });
        if (!game) { console.warn('[ws] player:join — game not found', gameId); return cb?.({ error: 'Game not found' }); }
        if (game.status === 'finished') { console.warn('[ws] player:join — game finished', gameId); return cb?.({ error: 'Game finished' }); }

        const MAX_PLAYERS = 40; // total devices autorisés (toutes modes confondues)
        if (game.players.length >= MAX_PLAYERS) { console.warn('[ws] player:join — game full', gameId); return cb?.({ error: 'Game full' }); }

        const player = await prisma.player.create({
          data: { gameId, pseudo, teamId: teamId ?? null, deviceFingerprint: deviceFingerprint ?? null },
          include: { team: true },
        });

        socket.join(room.game(gameId));
        socket.data = { gameId, playerId: player.id, role: 'player', teamId: player.teamId };

        io.to(room.game(gameId)).emit('player:joined', {
          playerId: player.id, pseudo: player.pseudo,
          teamId: player.teamId, teamName: player.team?.name ?? null, teamColor: player.team?.color ?? null,
        });
        console.log('[ws] player:join — OK', { playerId: player.id, pseudo: player.pseudo });
        cb?.({ playerId: player.id, teamId: player.teamId });
      } catch (err: any) {
        console.error('[ws] player:join — EXCEPTION', err?.message, err?.code, err?.stack);
        cb?.({ error: `Server error: ${err?.message ?? 'unknown'}` });
      }
    });

    // Reconnexion d'un participant
    socket.on('player:rejoin', async ({ gameId, playerId }: any, cb?: Function) => {
      const player = await prisma.player.findFirst({ where: { id: playerId, gameId }, include: { team: true, game: true } });
      if (!player) return cb?.({ error: 'Unknown player' });

      socket.join(room.game(gameId));
      socket.data = { gameId, playerId, role: 'player', teamId: player.teamId };

      const track = player.game.currentTrackIdx;
      const currentTrack = await prisma.track.findFirst({
        where: { playlistId: player.game.playlistId, position: track },
      });
      const queue = currentTrack ? await getBuzzQueue(gameId, currentTrack.id) : [];
      cb?.({
        ok: true,
        status: player.game.status,
        currentTrackIdx: track,
        buzzQueue: queue,
        team: player.team,
      });
    });

    // ===== GAME:START =====
    socket.on('game:start', async ({ gameId }: any) => {
      if (socket.data.role !== 'admin') return;
      if (await isGameFinished(gameId)) return;
      const game = await prisma.game.update({
        where: { id: gameId },
        data: { status: 'playing', startedAt: new Date(), currentTrackIdx: 0 },
        include: { playlist: { include: { tracks: { orderBy: { position: 'asc' } } } } },
      });
      io.to(room.game(gameId)).emit('game:start', {
        gameId,
        playlist: game.playlist,
        rules: {
          mode: game.mode,
          buzzersPerTeam: game.buzzersPerTeam,
          delayBeforeBuzz: game.delayBeforeBuzz,
        },
      });
    });

    // ===== TRACK CONTROL =====
    socket.on('track:play', async ({ gameId, trackIndex }: any) => {
      if (socket.data.role !== 'admin') return;
      if (await isGameFinished(gameId)) return;
      await prisma.game.update({ where: { id: gameId }, data: { currentTrackIdx: trackIndex } });
      io.to(room.game(gameId)).emit('track:play', { trackIndex, serverTs: Date.now() });
    });

    socket.on('track:pause', async ({ gameId, reason }: any) => {
      if (socket.data.role !== 'admin') return;
      if (await isGameFinished(gameId)) return;
      // CDC §5.1 : track:pause destinataires = animateur + présentation
      // (pas les participants — ils voient juste la conséquence côté UI)
      io.to(room.admin(gameId)).to(room.display(gameId)).emit('track:pause', { reason: reason ?? 'manual' });
    });

    socket.on('track:resume', async ({ gameId }: any) => {
      if (socket.data.role !== 'admin') return;
      if (await isGameFinished(gameId)) return;
      io.to(room.game(gameId)).emit('track:resume', {});
    });

    socket.on('track:next', async ({ gameId, trackIndex }: any) => {
      if (socket.data.role !== 'admin') return;
      if (await isGameFinished(gameId)) return;
      await prisma.game.update({ where: { id: gameId }, data: { currentTrackIdx: trackIndex } });
      io.to(room.game(gameId)).emit('track:next', { trackIndex });
    });

    socket.on('track:reveal', async ({ gameId, trackId }: any) => {
      if (await isGameFinished(gameId)) return;
      const track = await prisma.track.findUnique({ where: { id: trackId }, include: { hints: true } });
      if (!track) return;
      io.to(room.game(gameId)).emit('track:reveal', {
        title: track.title, artist: track.artist, imageUrl: track.imageUrl,
        sourceType: track.sourceType, sourceName: track.sourceName, year: track.year,
      });
    });

    // ===== PLAYER BUZZ =====
    socket.on('player:buzz', async ({ timestampClient }: { timestampClient: number }, cb?: Function) => {
      const { gameId, playerId, teamId } = socket.data;
      if (!gameId || !playerId) return cb?.({ error: 'Not in game' });

      const game = await prisma.game.findUnique({ where: { id: gameId }, include: { playlist: true } });
      if (!game || game.status !== 'playing') return cb?.({ error: 'Game not playing' });

      const track = await prisma.track.findFirst({
        where: { playlistId: game.playlistId, position: game.currentTrackIdx },
      });
      if (!track) return cb?.({ error: 'No current track' });

      const allowed = await canBuzz(gameId, track.id, playerId, teamId ?? null, game.buzzersPerTeam);
      if (!allowed.ok) return cb?.({ error: allowed.reason });

      const player = await prisma.player.findUnique({ where: { id: playerId }, include: { team: true } });
      if (!player) return cb?.({ error: 'Player not found' });

      await incrementBuzzCount(gameId, track.id, `p:${playerId}`);
      if (teamId) await incrementBuzzCount(gameId, track.id, `t:${teamId}`);

      const serverTs = Date.now();
      const entry = await addBuzz(gameId, track.id, {
        playerId, pseudo: player.pseudo,
        teamId: player.teamId, teamName: player.team?.name ?? null, teamColor: player.team?.color ?? null,
        timestampClient, timestampServer: serverTs, validated: null,
      });
      await persistBuzz(entry, gameId, track.id);

      io.to(room.game(gameId)).emit('player:buzz', entry);
      // Auto-pause au premier buzz — CDC §5.1 : animateur + présentation seulement
      if (entry.rank === 1) {
        io.to(room.admin(gameId)).to(room.display(gameId)).emit('track:pause', { reason: 'buzz' });
      }
      cb?.({ ok: true, rank: entry.rank });
    });

    // ===== BUZZ:VALIDATE =====
    socket.on('buzz:validate', async ({ gameId, trackId, playerId, correct, bonusPoints }: any) => {
      if (socket.data.role !== 'admin') return;
      if (await isGameFinished(gameId)) return;

      // Marquer le buzz en DB
      const buzz = await prisma.buzz.findFirst({ where: { gameId, trackId, playerId }, orderBy: { rank: 'desc' } });
      if (buzz) await prisma.buzz.update({ where: { id: buzz.id }, data: { validated: correct } });

      if (correct) {
        const player = await prisma.player.findUnique({ where: { id: playerId } });
        if (player) {
          await prisma.score.create({
            data: {
              gameId, trackId, playerId,
              teamId: player.teamId ?? null,
              points: 1,
              bonusPoints: bonusPoints ?? 0,
            },
          });
        }
        const scores = await scoresFor(gameId);
        io.to(room.game(gameId)).emit('buzz:validate', { playerId, correct: true, bonusPoints: bonusPoints ?? 0 });
        io.to(room.game(gameId)).emit('score:update', { scores });
      } else {
        io.to(room.game(gameId)).emit('buzz:validate', { playerId, correct: false });
      }
    });

    // ===== GAME:END =====
    socket.on('game:end', async ({ gameId }: any) => {
      if (socket.data.role !== 'admin') return;
      await prisma.game.update({ where: { id: gameId }, data: { status: 'finished', finishedAt: new Date() } });
      const scores = await scoresFor(gameId);
      io.to(room.game(gameId)).emit('game:end', { finalScores: scores });
    });

    // ===== TRACK RESET (quand on passe au morceau suivant) =====
    socket.on('track:reset', async ({ gameId, trackId }: any) => {
      if (socket.data.role !== 'admin') return;
      if (await isGameFinished(gameId)) return;
      await resetTrackState(gameId, trackId);
      io.to(room.game(gameId)).emit('track:reset', { trackId });
    });

  });
}

async function scoresFor(gameId: string) {
  const rows = await prisma.score.findMany({ where: { gameId }, include: { team: true, player: true } });
  const teams = new Map<string, { teamId: string; name: string; color: string; points: number }>();
  const players = new Map<string, { playerId: string; pseudo: string; points: number }>();
  for (const s of rows) {
    const total = s.points + s.bonusPoints;
    if (s.team) {
      const e = teams.get(s.teamId!) ?? { teamId: s.teamId!, name: s.team.name, color: s.team.color, points: 0 };
      e.points += total;
      teams.set(s.teamId!, e);
    }
    if (s.player) {
      const e = players.get(s.playerId!) ?? { playerId: s.playerId!, pseudo: s.player.pseudo, points: 0 };
      e.points += total;
      players.set(s.playerId!, e);
    }
  }
  return {
    teams: [...teams.values()].sort((a, b) => b.points - a.points),
    players: [...players.values()].sort((a, b) => b.points - a.points),
  };
}
