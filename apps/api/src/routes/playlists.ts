import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { writePlaylistMd } from '../services/playlistMd.js';

// ============================================================
// Backfill : cherche un `previewUrl` sur Deezer pour un couple
// (artist, title). Utilisé pour les playlists importées avant
// l'ajout du champ previewUrl.
// ============================================================
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

async function findDeezerPreview(title: string, artist: string | null): Promise<string | null> {
  const q = [artist, title].filter(Boolean).join(' ').replace(/[()\[\]"']/g, ' ').trim();
  if (!q) return null;
  const url = `https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=1`;
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
    if (!r.ok) return null;
    const j: any = await r.json();
    const hit = j?.data?.[0];
    return hit?.preview || null;
  } catch { return null; }
}

const trackPatchSchema = z.object({
  title: z.string().optional(),
  artist: z.string().optional(),
  year: z.number().optional().nullable(),
  sourceType: z.enum(['film', 'manga', 'jeu', 'serie', 'autre']).optional().nullable(),
  sourceName: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  filePath: z.string().optional().nullable(),
  hasBonus: z.boolean().optional(),
  hints: z.array(z.string()).optional(),
});

export async function registerPlaylistRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  app.get('/', async (req) => {
    const userId = (req.user as any).sub as string;
    return prisma.playlist.findMany({
      where: { userId },
      include: { _count: { select: { tracks: true } } },
      orderBy: { updatedAt: 'desc' },
    });
  });

  app.get('/:id', async (req, reply) => {
    const userId = (req.user as any).sub as string;
    const { id } = req.params as { id: string };
    const playlist = await prisma.playlist.findFirst({
      where: { id, userId },
      include: {
        tracks: { orderBy: { position: 'asc' }, include: { hints: { orderBy: { hintOrder: 'asc' } } } },
      },
    });
    if (!playlist) return reply.code(404).send({ error: 'Not found' });
    return playlist;
  });

  app.delete('/:id', async (req, reply) => {
    const userId = (req.user as any).sub as string;
    const { id } = req.params as { id: string };
    const pl = await prisma.playlist.findFirst({ where: { id, userId } });
    if (!pl) return reply.code(404).send({ error: 'Not found' });
    await prisma.playlist.delete({ where: { id } });
    return { ok: true };
  });

  app.patch('/:id', async (req) => {
    const userId = (req.user as any).sub as string;
    const { id } = req.params as { id: string };
    const { name } = req.body as { name?: string };
    return prisma.playlist.update({ where: { id, userId } as any, data: { name } });
  });

  // Patch d'un morceau (indices + bonus)
  app.patch('/tracks/:trackId', async (req, reply) => {
    const userId = (req.user as any).sub as string;
    const { trackId } = req.params as { trackId: string };
    const parsed = trackPatchSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid payload' });

    const track = await prisma.track.findFirst({ where: { id: trackId, playlist: { userId } } });
    if (!track) return reply.code(404).send({ error: 'Not found' });

    const { hints, ...rest } = parsed.data;
    await prisma.track.update({ where: { id: trackId }, data: rest as any });

    if (hints) {
      await prisma.trackHint.deleteMany({ where: { trackId, source: 'manual' } });
      await prisma.trackHint.createMany({
        data: hints.filter(Boolean).map((hintText, i) => ({ trackId, hintText, hintOrder: i, source: 'manual' as const })),
      });
    }

    return prisma.track.findUnique({
      where: { id: trackId },
      include: { hints: { orderBy: { hintOrder: 'asc' } } },
    });
  });

  // Export d'une playlist au format .md (CDC §7.4). Télécharge un fichier
  // texte conforme au format documenté, réimportable via /api/import/md.
  app.get('/:id/export.md', async (req, reply) => {
    const userId = (req.user as any).sub as string;
    const { id } = req.params as { id: string };
    const playlist = await prisma.playlist.findFirst({
      where: { id, userId },
      include: {
        tracks: { orderBy: { position: 'asc' }, include: { hints: { orderBy: { hintOrder: 'asc' } } } },
      },
    });
    if (!playlist) return reply.code(404).send({ error: 'Not found' });

    const md = writePlaylistMd({
      name: playlist.name,
      sourcePlatform: playlist.sourcePlatform,
      createdAt: playlist.createdAt,
      tracks: playlist.tracks,
    });
    const filename = playlist.name.replace(/[^a-z0-9-_]+/gi, '_') + '.md';
    reply.header('Content-Type', 'text/markdown; charset=utf-8');
    reply.header('Content-Disposition', `attachment; filename="${filename}"`);
    return md;
  });

  // POST /api/playlists/:id/refresh-previews — récupère les URLs MP3 30s
  // manquantes via l'API de recherche Deezer (gratuite, pas d'auth).
  app.post('/:id/refresh-previews', async (req, reply) => {
    const userId = (req.user as any).sub as string;
    const { id } = req.params as { id: string };
    const playlist = await prisma.playlist.findFirst({ where: { id, userId }, include: { tracks: true } });
    if (!playlist) return reply.code(404).send({ error: 'Not found' });

    let updated = 0;
    let missing = 0;
    for (const t of playlist.tracks) {
      if (t.previewUrl) continue; // déjà présent, on ne retouche pas
      const preview = await findDeezerPreview(t.title, t.artist);
      if (preview) {
        await prisma.track.update({ where: { id: t.id }, data: { previewUrl: preview } });
        updated++;
      } else {
        missing++;
      }
    }
    return { ok: true, updated, missing, total: playlist.tracks.length };
  });

}
