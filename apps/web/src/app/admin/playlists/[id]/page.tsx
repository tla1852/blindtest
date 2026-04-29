'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function EditPlaylist() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  useEffect(() => { load(); }, [id]);
  async function load() { setData(await api(`/api/playlists/${id}`)); }

  async function updateTrack(trackId: string, patch: any) {
    await api(`/api/playlists/tracks/${trackId}`, { method: 'PATCH', body: JSON.stringify(patch) });
    load();
  }

  if (!data) return <div className="p-10 font-pixel text-xs neon-text-cyan">Chargement…</div>;

  return (
    <main className="min-h-screen relative z-10 p-6 md:p-10 max-w-4xl mx-auto">
      <button onClick={() => router.back()} className="font-pixel text-xs neon-text-cyan mb-6">← Retour</button>
      <h1 className="font-pixel text-lg neon-text-pink mb-2">{data.name}</h1>
      <p className="text-white/50 text-sm mb-8">{data.tracks.length} morceaux · {data.sourcePlatform}</p>

      <ul className="space-y-2">
        {data.tracks.map((t: any, i: number) => (
          <li key={t.id} className="card">
            <button onClick={() => setOpen(o => ({ ...o, [t.id]: !o[t.id] }))}
              className="w-full flex items-center gap-4 text-left">
              {t.imageUrl && <img src={t.imageUrl} alt="" className="w-12 h-12 rounded" />}
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{i + 1}. {t.title}</div>
                <div className="text-xs text-white/50 truncate">{t.artist ?? '—'} · {t.year ?? ''}</div>
              </div>
              {t.hasBonus && <span className="font-pixel text-xs neon-text-gold">★ BONUS</span>}
              <span className="text-white/40">{open[t.id] ? '−' : '+'}</span>
            </button>
            {open[t.id] && (
              <div className="mt-4 pt-4 border-t border-white/10 space-y-3">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={t.hasBonus}
                    onChange={(e) => updateTrack(t.id, { hasBonus: e.target.checked })} />
                  <span className="text-sm">Accorder un point bonus (2 points max pour ce morceau)</span>
                </label>
                <div>
                  <label className="text-xs neon-text-cyan font-pixel block mb-2">INDICES</label>
                  <HintsEditor hints={t.hints} onSave={(hints) => updateTrack(t.id, { hints })} />
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}

function HintsEditor({ hints, onSave }: { hints: any[]; onSave: (h: string[]) => void }) {
  const [items, setItems] = useState<string[]>(hints.map(h => h.hintText));
  return (
    <div className="space-y-2">
      {items.map((h, i) => (
        <div key={i} className="flex gap-2">
          <input value={h} onChange={e => setItems(items.map((x, j) => j === i ? e.target.value : x))}
            className="flex-1 bg-bg-soft border border-white/10 rounded px-3 py-2 text-sm" />
          <button onClick={() => setItems(items.filter((_, j) => j !== i))} className="text-white/50 hover:text-red-400">×</button>
        </div>
      ))}
      <div className="flex gap-2">
        <button onClick={() => setItems([...items, ''])}
          className="text-xs px-3 py-2 rounded border border-white/20 hover:border-neon-cyan">+ Ajouter un indice</button>
        <button onClick={() => onSave(items.filter(Boolean))}
          className="text-xs px-3 py-2 rounded border border-neon-gold text-neon-gold hover:bg-neon-gold/20">Enregistrer</button>
      </div>
    </div>
  );
}
