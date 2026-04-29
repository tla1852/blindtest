'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { clearAuth, getUser } from '@/lib/auth';

export default function AdminDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [games, setGames] = useState<any[]>([]);
  const [importUrl, setImportUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const u = getUser();
    if (!u) { router.replace('/admin/login'); return; }
    setUser(u);
    refresh();
  }, [router]);

  async function refresh() {
    try {
      const [pl, gs] = await Promise.all([
        api<any[]>('/api/playlists'),
        api<any[]>('/api/games'),
      ]);
      setPlaylists(pl);
      setGames(gs);
    } catch (e: any) {
      if (String(e.message).includes('401')) {
        clearAuth();
        router.replace('/admin/login');
      }
    }
  }

  async function doImport() {
    setBusy(true); setMsg(null);
    try {
      const r: any = await api('/api/import', { method: 'POST', body: JSON.stringify({ url: importUrl }) });
      setMsg(`✅ Import réussi : ${r.name} (${r.trackCount} morceaux)`);
      setImportUrl('');
      refresh();
    } catch (e: any) {
      setMsg(`❌ ${e.message}`);
    } finally { setBusy(false); }
  }

  async function importMd(file: File) {
    setBusy(true); setMsg(null);
    try {
      const content = await file.text();
      const r: any = await api('/api/import/md', {
        method: 'POST',
        body: JSON.stringify({ content, name: file.name.replace(/\.md$/i, '') }),
      });
      const warns = (r.warnings ?? []).length ? ` (${r.warnings.length} avertissement(s))` : '';
      setMsg(`✅ Import .md : ${r.name} (${r.trackCount} morceaux)${warns}`);
      refresh();
    } catch (e: any) {
      setMsg(`❌ ${e.message}`);
    } finally { setBusy(false); }
  }

  async function deletePlaylist(id: string) {
    if (!confirm('Supprimer cette playlist ?')) return;
    await api(`/api/playlists/${id}`, { method: 'DELETE' });
    refresh();
  }

  async function exportMd(id: string, name: string) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('rb_token') : null;
    const res = await fetch(`/api/playlists/${id}/export.md`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) { setMsg(`❌ Export impossible`); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${name}.md`.replace(/[^a-z0-9-_.]+/gi, '_');
    a.click();
    URL.revokeObjectURL(url);
  }

  async function deleteGame(id: string) {
    if (!confirm('Supprimer définitivement cette partie et tous ses scores ?')) return;
    await api(`/api/games/${id}`, { method: 'DELETE' });
    refresh();
  }

  function logout() { clearAuth(); router.replace('/admin/login'); }

  if (!user) return null;
  return (
    <main className="min-h-screen relative z-10 p-6 md:p-10 max-w-6xl mx-auto">
      <header className="flex items-center justify-between mb-10">
        <h1 className="font-pixel text-lg md:text-2xl neon-text-pink">
          RETRO<span className="neon-text-cyan">BUZZ</span>
        </h1>
        <div className="flex items-center gap-4">
          <span className="text-white/70 text-sm">{user.displayName}</span>
          <button onClick={logout} className="text-xs text-white/50 hover:text-neon-pink">Déconnexion</button>
        </div>
      </header>

      <section className="mb-10 card">
        <h2 className="font-pixel text-xs neon-text-cyan mb-4">IMPORTER UNE PLAYLIST</h2>
        <div className="flex flex-col md:flex-row gap-3">
          <input
            type="url"
            value={importUrl}
            onChange={(e) => setImportUrl(e.target.value)}
            placeholder="Lien YouTube / Deezer (public)"
            className="flex-1 bg-bg-soft border border-white/10 rounded px-4 py-3 focus:border-neon-cyan outline-none"
          />
          <button
            onClick={doImport}
            disabled={busy || !importUrl}
            className="font-pixel text-xs px-6 py-3 rounded border-2 border-neon-cyan text-neon-cyan hover:bg-neon-cyan/20 disabled:opacity-40"
          >{busy ? '…' : 'IMPORTER'}</button>
        </div>
        <div className="mt-4 pt-4 border-t border-white/10">
          <label className="font-pixel text-xs neon-text-violet block mb-2">OU IMPORTER UN FICHIER .MD</label>
          <input
            type="file"
            accept=".md,text/markdown"
            disabled={busy}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) importMd(f); e.target.value = ''; }}
            className="text-xs text-white/70 file:font-pixel file:text-xs file:px-4 file:py-2 file:rounded file:border-2 file:border-neon-violet file:text-neon-violet file:bg-transparent file:mr-3 file:cursor-pointer"
          />
        </div>
        {msg && <p className="mt-3 text-sm text-white/80">{msg}</p>}
      </section>

      <section className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-pixel text-xs neon-text-violet">MES PLAYLISTS ({playlists.length})</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {playlists.map(p => (
            <div key={p.id} className="card flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="font-semibold truncate">{p.name}</div>
                <div className="text-xs text-white/50">{p._count?.tracks ?? p.trackCount} morceaux · {p.sourcePlatform}</div>
              </div>
              <div className="flex gap-2 shrink-0">
                <Link href={`/admin/playlists/${p.id}`} className="text-xs px-3 py-2 rounded border border-white/20 hover:border-neon-cyan">Éditer</Link>
                <button onClick={() => exportMd(p.id, p.name)} className="text-xs px-3 py-2 rounded border border-white/20 hover:border-neon-violet hover:text-neon-violet" title="Exporter en .md">↓ .md</button>
                <button onClick={() => deletePlaylist(p.id)} className="text-xs px-3 py-2 rounded border border-white/20 hover:border-red-500 hover:text-red-400">×</button>
              </div>
            </div>
          ))}
          {playlists.length === 0 && <p className="text-white/50">Aucune playlist. Importez-en une pour commencer.</p>}
        </div>
      </section>

      <section className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-pixel text-xs neon-text-gold">NOUVELLE PARTIE</h2>
          <Link href="/admin/game/new" className="font-pixel text-xs px-6 py-3 rounded border-2 border-neon-gold text-neon-gold hover:bg-neon-gold/20 shadow-neon-gold">
            + CRÉER
          </Link>
        </div>
      </section>

      <section>
        <h2 className="font-pixel text-xs neon-text-pink mb-4">PARTIES RÉCENTES</h2>
        <div className="grid gap-2">
          {games.map(g => (
            <div key={g.id} className="card flex items-center justify-between gap-4 hover:border-neon-pink transition">
              <Link href={`/admin/game/${g.id}`} className="flex-1 min-w-0">
                <div className="font-semibold truncate">{g.playlist?.name ?? 'Playlist supprimée'}</div>
                <div className="text-xs text-white/50">
                  {g.mode} · {g.status} · {g._count?.players ?? 0} joueurs · {new Date(g.createdAt).toLocaleString('fr-FR')}
                </div>
              </Link>
              <div className="flex items-center gap-2 shrink-0">
                <Link href={`/admin/game/${g.id}`} className="font-pixel text-xs neon-text-cyan">→</Link>
                <button onClick={() => deleteGame(g.id)} className="text-xs px-3 py-2 rounded border border-white/20 hover:border-red-500 hover:text-red-400">×</button>
              </div>
            </div>
          ))}
          {games.length === 0 && <p className="text-white/50">Aucune partie.</p>}
        </div>
      </section>
    </main>
  );
}
