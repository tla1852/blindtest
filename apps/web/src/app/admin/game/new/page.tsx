'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

// Palette de couleurs par défaut (alignée sur backend games.ts)
const TEAM_COLORS = ['#A855F7', '#F472B6', '#38BDF8', '#FBBF24', '#10B981', '#EF4444', '#F97316', '#8B5CF6'];

type TeamDraft = { name: string; color: string };

export default function NewGame() {
  const router = useRouter();
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [playlistId, setPlaylistId] = useState('');
  const [mode, setMode] = useState<'FFA' | 'TDM'>('FFA');
  const [buzzersPerTeam, setBuzzers] = useState(2);
  const [delay, setDelay] = useState(0);
  const [maxTeams, setMaxTeams] = useState(4);
  const [teams, setTeams] = useState<TeamDraft[]>(
    Array.from({ length: 4 }, (_, i) => ({ name: `Équipe ${i + 1}`, color: TEAM_COLORS[i] }))
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => { api('/api/playlists').then(setPlaylists); }, []);

  // Redimensionne dynamiquement la liste d'équipes quand maxTeams change —
  // en préservant les noms déjà saisis et en complétant/coupant le reste.
  useEffect(() => {
    setTeams(prev => {
      if (prev.length === maxTeams) return prev;
      if (prev.length < maxTeams) {
        const extra = Array.from({ length: maxTeams - prev.length }, (_, i) => {
          const idx = prev.length + i;
          return { name: `Équipe ${idx + 1}`, color: TEAM_COLORS[idx % TEAM_COLORS.length] };
        });
        return [...prev, ...extra];
      }
      return prev.slice(0, maxTeams);
    });
  }, [maxTeams]);

  function updateTeamName(idx: number, name: string) {
    setTeams(prev => prev.map((t, i) => (i === idx ? { ...t, name } : t)));
  }

  function updateTeamColor(idx: number, color: string) {
    setTeams(prev => prev.map((t, i) => (i === idx ? { ...t, color } : t)));
  }

  // Les noms d'équipes ne doivent pas être vides et doivent être uniques.
  const teamsError = useMemo(() => {
    if (mode !== 'TDM') return null;
    const trimmed = teams.map(t => t.name.trim());
    if (trimmed.some(n => !n)) return 'Chaque équipe doit avoir un nom';
    const dedup = new Set(trimmed.map(n => n.toLowerCase()));
    if (dedup.size !== trimmed.length) return 'Deux équipes ne peuvent pas porter le même nom';
    return null;
  }, [mode, teams]);

  async function create() {
    if (!playlistId) return;
    if (mode === 'TDM' && teamsError) { alert(teamsError); return; }
    setLoading(true);
    try {
      const payload: any = { playlistId, mode, buzzersPerTeam, delayBeforeBuzz: delay, maxTeams };
      if (mode === 'TDM') {
        payload.teams = teams.map(t => ({ name: t.name.trim(), color: t.color }));
      }
      const g: any = await api('/api/games', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      router.replace(`/admin/game/${g.id}`);
    } finally { setLoading(false); }
  }

  return (
    <main className="min-h-screen relative z-10 p-6 md:p-10 max-w-2xl mx-auto">
      <button onClick={() => router.back()} className="font-pixel text-xs neon-text-cyan mb-6">← Retour</button>
      <h1 className="font-pixel text-lg neon-text-gold mb-8">NOUVELLE PARTIE</h1>

      <div className="space-y-6">
        <div>
          <label className="font-pixel text-xs neon-text-violet block mb-2">MODE DE JEU</label>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setMode('FFA')}
              className={`card text-left border-2 ${mode === 'FFA' ? 'border-neon-pink shadow-neon-pink' : 'border-white/10'}`}>
              <div className="font-pixel text-xs neon-text-pink mb-2">FREE FOR ALL</div>
              <div className="text-xs text-white/70">Chaque joueur pour soi. Jusqu'à 40 participants.</div>
            </button>
            <button onClick={() => setMode('TDM')}
              className={`card text-left border-2 ${mode === 'TDM' ? 'border-neon-cyan shadow-neon-cyan' : 'border-white/10'}`}>
              <div className="font-pixel text-xs neon-text-cyan mb-2">TEAM DEATHMATCH</div>
              <div className="text-xs text-white/70">Équipes (8 max). Par défaut 2 buzz par équipe.</div>
            </button>
          </div>
        </div>

        <div>
          <label className="font-pixel text-xs neon-text-violet block mb-2">PLAYLIST</label>
          <select value={playlistId} onChange={e => setPlaylistId(e.target.value)}
            className="w-full bg-bg-soft border border-white/10 rounded px-4 py-3 focus:border-neon-cyan outline-none">
            <option value="">— Sélectionner —</option>
            {playlists.map(p => <option key={p.id} value={p.id}>{p.name} ({p._count?.tracks ?? 0})</option>)}
          </select>
        </div>

        {mode === 'TDM' && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="font-pixel text-xs neon-text-violet block mb-2">NOMBRE D'ÉQUIPES</label>
                <input type="number" min={2} max={8} value={maxTeams}
                  onChange={e => setMaxTeams(Math.max(2, Math.min(8, Number(e.target.value) || 2)))}
                  className="w-full bg-bg-soft border border-white/10 rounded px-4 py-3" />
              </div>
              <div>
                <label className="font-pixel text-xs neon-text-violet block mb-2">BUZZ / ÉQUIPE / MANCHE</label>
                <input type="number" min={1} max={10} value={buzzersPerTeam}
                  onChange={e => setBuzzers(Number(e.target.value))}
                  className="w-full bg-bg-soft border border-white/10 rounded px-4 py-3" />
              </div>
            </div>

            <div>
              <label className="font-pixel text-xs neon-text-violet block mb-2">NOMS DES ÉQUIPES</label>
              <div className="space-y-2">
                {teams.map((t, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <input type="color" value={t.color}
                      onChange={e => updateTeamColor(i, e.target.value)}
                      className="h-10 w-12 rounded bg-bg-soft border border-white/10 cursor-pointer"
                      title="Couleur de l'équipe" />
                    <input type="text" value={t.name} maxLength={24}
                      onChange={e => updateTeamName(i, e.target.value)}
                      placeholder={`Équipe ${i + 1}`}
                      className="flex-1 bg-bg-soft border border-white/10 rounded px-4 py-3 focus:border-neon-cyan outline-none" />
                  </div>
                ))}
              </div>
              {teamsError && (
                <p className="text-xs text-neon-pink mt-2">{teamsError}</p>
              )}
              <p className="text-xs text-white/40 mt-2">
                Les joueurs choisiront leur équipe en rejoignant la partie.
              </p>
            </div>
          </>
        )}

        <div>
          <label className="font-pixel text-xs neon-text-violet block mb-2">DÉLAI AVANT BUZZ (SECONDES)</label>
          <input type="number" min={0} max={60} value={delay}
            onChange={e => setDelay(Number(e.target.value))}
            className="w-full bg-bg-soft border border-white/10 rounded px-4 py-3" />
          <p className="text-xs text-white/40 mt-1">0 = buzz autorisé dès le lancement de la chanson</p>
        </div>

        <button onClick={create} disabled={!playlistId || loading}
          className="w-full font-pixel text-xs py-4 rounded border-2 border-neon-gold text-neon-gold hover:bg-neon-gold/20 shadow-neon-gold disabled:opacity-40">
          {loading ? '...' : 'CRÉER LA PARTIE →'}
        </button>
      </div>
    </main>
  );
}
