import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { importFromYoutube } from '../services/youtube.js';
import { importFromDeezer } from '../services/deezer.js';
import { triggerN8nEnrichment } from '../services/n8n.js';
import { parsePlaylistMd } from '../services/playlistMd.js';

const schema = z.object({
  url: z.string().url(),
  name: z.string().optional(),
});

const mdSchema = z.object({
  content: z.string().min(1).max(5 * 1024 * 1024), // 5 MB max
  name: z.string().optional(),
  mdFilePath: z.string().optional(),
});

function detectPlatform(url: string): 'youtube' | 'deezer' | null {
  if (/(youtube\.com|youtu\.be)/.test(url)) return 'youtube';
  if (/deezer\.com\/.*(playlist|album)\//.test(url)) return 'deezer';
  if (/link\.deezer\.com\/s\//.test(url)) return 'deezer'; // liens courts de partage
  return null;
}

export async function registerImportRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  // Rate limit : 10 imports / heure / utilisateur (CDC §9.2)
  app.post('/', {
    config: { rateLimit: { max: 10, timeWindow: '1 hour', keyGenerator: (req: any) => req.user?.sub ?? req.ip } },
  }, async (req, reply) => {
    const userId = (req.user as any).sub as string;
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid payload' });
    const { url, name } = parsed.data;

    const platform = detectPlatform(url);
    if (!platform) return reply.code(400).send({ error: 'Plateforme non supportée (YouTube / Deezer)' });

    try {
      const data = platform === 'youtube'
        ? await importFromYoutube(url)
        : await importFromDeezer(url);

      const playlist = await prisma.playlist.create({
        data: {
          userId,
          name: name ?? data.name,
          sourceUrl: url,
          sourcePlatform: platform,
          trackCount: data.tracks.length,
          tracks: {
            create: data.tracks.map((t, i) => ({
              title: t.title,
              artist: t.artist ?? null,
              year: t.year ?? null,
              imageUrl: t.imageUrl ?? null,
              previewUrl: t.previewUrl ?? null,
              position: i,
            })),
          },
        },
        include: { tracks: true },
      });

      // Enrichissement asynchrone (ne bloque pas la réponse)
      triggerN8nEnrichment(playlist.id).catch((e) => req.log.warn(`N8N webhook failed: ${e.message}`));

      return { id: playlist.id, name: playlist.name, trackCount: playlist.trackCount };
    } catch (e: any) {
      req.log.error({ err: e }, 'import failed');
      return reply.code(502).send({ error: e.message ?? 'Import failed' });
    }
  });

  // Import depuis un fichier .md (CDC §4.1.1 / §7.4). Le contenu est envoyé
  // tel quel par l'app Windows (file picker côté client) — pas de rate limit
  // car le parsing est 100% local, aucun appel API externe.
  app.post('/md', async (req, reply) => {
    const userId = (req.user as any).sub as string;
    const parsed = mdSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid payload' });

    const result = parsePlaylistMd(parsed.data.content);
    if (result.tracks.length === 0) {
      return reply.code(400).send({ error: 'Aucun morceau valide trouvé', warnings: result.warnings });
    }

    const playlist = await prisma.playlist.create({
      data: {
        userId,
        name: parsed.data.name ?? result.name,
        sourcePlatform: 'manual',
        mdFilePath: parsed.data.mdFilePath ?? null,
        trackCount: result.tracks.length,
        tracks: {
          create: result.tracks.map((t, i) => ({
            title: t.title,
            artist: t.artist,
            year: t.year,
            sourceType: t.sourceType,
            sourceName: t.sourceName,
            imageUrl: t.imageUrl,
            filePath: t.filePath,
            hasBonus: t.hasBonus,
            position: i,
            hints: {
              create: t.hints.map((hintText, hi) => ({
                hintText,
                hintOrder: hi,
                source: 'manual' as const,
              })),
            },
          })),
        },
      },
    });

    return {
      id: playlist.id,
      name: playlist.name,
      trackCount: playlist.trackCount,
      warnings: result.warnings,
    };
  });
}
