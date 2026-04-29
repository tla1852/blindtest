import { config } from '../config.js';
import { prisma } from '../db.js';

/**
 * Déclenche le workflow N8N d'enrichissement pour une playlist.
 * Le workflow distant est responsable de :
 *  1. récupérer les morceaux via l'API
 *  2. enrichir via MusicBrainz / TheMovieDB / Jikan
 *  3. appeler POST /api/stats/... (ou un endpoint dédié) pour écrire les indices
 *
 * En l'absence d'URL N8N configurée, l'appel est un no-op (pas d'échec).
 */
export async function triggerN8nEnrichment(playlistId: string) {
  if (!config.n8n.webhookUrl) return;

  const tracks = await prisma.track.findMany({
    where: { playlistId },
    select: { id: true, title: true, artist: true, year: true },
  });

  await fetch(config.n8n.webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(config.n8n.token ? { Authorization: `Bearer ${config.n8n.token}` } : {}),
    },
    body: JSON.stringify({ playlistId, tracks }),
  });
}
