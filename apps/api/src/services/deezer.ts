// Deezer bloque maintenant les requêtes sans User-Agent "navigateur".
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

function extractId(url: string): { kind: 'playlist' | 'album'; id: string } | null {
  const pl = url.match(/playlist\/(\d+)/);
  if (pl) return { kind: 'playlist', id: pl[1] };
  const al = url.match(/album\/(\d+)/);
  if (al) return { kind: 'album', id: al[1] };
  return null;
}

// Les liens de partage `https://link.deezer.com/s/XXXX` redirigent vers l'URL canonique.
// Avec `redirect: 'follow'`, fetch suit la redirection et on lit `response.url`.
async function resolveShortLink(url: string): Promise<string> {
  if (!/link\.deezer\.com\/s\//.test(url)) return url;
  try {
    const r = await fetch(url, { method: 'GET', redirect: 'follow', headers: { 'User-Agent': UA } });
    return r.url || url;
  } catch {
    return url;
  }
}

async function deezerJson(url: string): Promise<any> {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  const text = await res.text();
  let json: any;
  try { json = JSON.parse(text); }
  catch {
    throw new Error(`Deezer API: réponse non-JSON (HTTP ${res.status}) — ${text.slice(0, 200)}`);
  }
  if (json.error) throw new Error(`Deezer: ${json.error.message ?? json.error.type ?? 'erreur inconnue'}`);
  return json;
}

export async function importFromDeezer(url: string) {
  const resolved = await resolveShortLink(url);
  const m = extractId(resolved);
  if (!m) throw new Error(`URL Deezer invalide (après résolution : ${resolved})`);

  const meta = await deezerJson(`https://api.deezer.com/${m.kind}/${m.id}`);

  const name = meta.title ?? 'Deezer';
  const tracks: Array<{ title: string; artist?: string; year?: number; imageUrl?: string; previewUrl?: string }> = [];

  let next: string | null = `https://api.deezer.com/${m.kind}/${m.id}/tracks?limit=100`;
  while (next) {
    const d: any = await deezerJson(next);
    for (const t of d.data ?? []) {
      tracks.push({
        title: t.title,
        artist: t.artist?.name,
        imageUrl: t.album?.cover_medium ?? t.album?.cover,
        // Deezer fournit un MP3 de 30s librement accessible
        previewUrl: t.preview || undefined,
      });
    }
    next = d.next ?? null;
  }

  if (tracks.length === 0) throw new Error('Deezer: aucune piste trouvée (playlist vide ou privée ?)');

  return { name, tracks };
}
