import { config } from '../config.js';

function extractListId(url: string): string | null {
  const m = url.match(/[?&]list=([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}

export async function importFromYoutube(url: string) {
  if (!config.youtube.apiKey) throw new Error('YOUTUBE_API_KEY manquante');
  const listId = extractListId(url);
  if (!listId) throw new Error('URL YouTube invalide (paramètre list manquant)');

  let name = 'YouTube Playlist';
  try {
    const meta: any = await (await fetch(
      `https://www.googleapis.com/youtube/v3/playlists?part=snippet&id=${listId}&key=${config.youtube.apiKey}`
    )).json();
    name = meta.items?.[0]?.snippet?.title ?? name;
  } catch {}

  const tracks: Array<{ title: string; artist?: string; imageUrl?: string }> = [];
  let pageToken: string | undefined = undefined;
  do {
    const u = new URL('https://www.googleapis.com/youtube/v3/playlistItems');
    u.searchParams.set('part', 'snippet');
    u.searchParams.set('maxResults', '50');
    u.searchParams.set('playlistId', listId);
    u.searchParams.set('key', config.youtube.apiKey);
    if (pageToken) u.searchParams.set('pageToken', pageToken);

    const r = await fetch(u.toString());
    if (!r.ok) throw new Error(`YouTube error ${r.status}`);
    const data: any = await r.json();
    for (const it of data.items ?? []) {
      const sn = it.snippet;
      tracks.push({
        title: sn.title,
        artist: sn.videoOwnerChannelTitle ?? sn.channelTitle,
        imageUrl: sn.thumbnails?.high?.url ?? sn.thumbnails?.default?.url,
      });
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  return { name, tracks };
}
