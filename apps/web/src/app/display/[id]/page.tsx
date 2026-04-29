'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { QrCode } from '@/components/QrCode';
import { Equalizer } from '@/components/Equalizer';
import { Scoreboard } from '@/components/Scoreboard';

export default function Display() {
  const { id } = useParams<{ id: string }>();
  const [game, setGame] = useState<any>(null);
  const [buzzes, setBuzzes] = useState<any[]>([]);
  const [scores, setScores] = useState<any>({ teams: [], players: [] });
  const [playing, setPlaying] = useState(false);
  const [revealed, setRevealed] = useState<any>(null);
  const [trackIdx, setTrackIdx] = useState(0);
  const [finalScores, setFinalScores] = useState<any>(null);
  const urlRef = useRef('');

  useEffect(() => {
    urlRef.current = `${window.location.origin}/play/${id}`;
    api(`/api/games/${id}`).then((g: any) => {
      setGame(g);
      if (typeof g?.currentTrackIdx === 'number') setTrackIdx(g.currentTrackIdx);
      if (g?.status === 'playing') setPlaying(true);
    });
    api(`/api/games/${id}/scores`).then(setScores);

    const s = getSocket();
    s.emit('display:join', { gameId: id });

    s.on('player:buzz', (b: any) => setBuzzes(q => [...q, b]));
    s.on('buzz:validate', ({ playerId, correct }: any) =>
      setBuzzes(q => q.map(b => b.playerId === playerId ? { ...b, validated: correct } : b))
    );
    s.on('score:update', ({ scores }: any) => setScores(scores));
    s.on('track:play', ({ trackIndex }: any) => { setPlaying(true); setRevealed(null); setBuzzes([]); setTrackIdx(trackIndex); });
    s.on('track:pause', () => setPlaying(false));
    s.on('track:resume', () => setPlaying(true));
    s.on('track:next', ({ trackIndex }: any) => { setTrackIdx(trackIndex); setBuzzes([]); setRevealed(null); });
    s.on('track:reveal', (data: any) => setRevealed(data));
    s.on('track:reset', () => { setBuzzes([]); setRevealed(null); });
    s.on('game:start', () => {
      setBuzzes([]); setRevealed(null); setTrackIdx(0); setPlaying(false); setFinalScores(null);
      api(`/api/games/${id}`).then(setGame);
    });
    s.on('game:end', ({ finalScores }: any) => {
      setPlaying(false); setRevealed(null); setBuzzes([]);
      setFinalScores(finalScores ?? null);
      api(`/api/games/${id}`).then(setGame);
    });
    s.on('player:joined', () => api(`/api/games/${id}`).then(setGame));

    return () => { s.removeAllListeners(); };
  }, [id]);

  if (!game) return null;

  const isWaiting = game.status === 'waiting';
  const isFinished = game.status === 'finished';
  const total = game.playlist?.tracks?.length ?? 0;
  const endScores = finalScores ?? scores;

  return (
    <main className="min-h-screen relative z-10 p-6 md:p-12 max-w-7xl mx-auto">
      <header className="flex items-center justify-between mb-10">
        <h1 className="font-pixel text-xl md:text-3xl neon-text-pink">
          RETRO<span className="neon-text-cyan">BUZZ</span>
        </h1>
        <div className="font-pixel text-sm neon-text-gold">{game.mode === 'TDM' ? 'TEAM MODE' : 'FREE FOR ALL'}</div>
      </header>

      {isFinished ? (
        <section className="text-center space-y-8">
          <h2 className="font-pixel text-2xl md:text-4xl neon-text-gold">PARTIE TERMINÉE</h2>
          <p className="text-white/70">Merci d'avoir joué !</p>
          <div className="max-w-2xl mx-auto">
            <Scoreboard teams={endScores.teams} players={endScores.players} mode={game.mode} />
          </div>
        </section>
      ) : isWaiting ? (
        <section className="grid md:grid-cols-2 gap-10 items-center">
          <div>
            <h2 className="font-pixel text-lg md:text-2xl neon-text-cyan mb-6">SCANNEZ POUR REJOINDRE</h2>
            <QrCode value={urlRef.current} size={320} />
            <p className="mt-4 text-white/60">ou ouvrir <span className="neon-text-cyan">{urlRef.current}</span></p>
          </div>
          <div className="card">
            <div className="font-pixel text-xs neon-text-pink mb-3">JOUEURS CONNECTÉS ({game.players.length})</div>
            <ul className="space-y-2">
              {game.players.map((p: any) => (
                <li key={p.id} className="flex items-center gap-3">
                  {p.team && <span className="w-3 h-3 rounded-full" style={{ background: p.team.color }} />}
                  <span className="text-lg">{p.pseudo}</span>
                  {p.team && <span className="text-xs text-white/40">({p.team.name})</span>}
                </li>
              ))}
              {game.players.length === 0 && <li className="text-white/50">En attente…</li>}
            </ul>
          </div>
        </section>
      ) : (
        <section className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="card text-center">
              <div className="font-pixel text-xs neon-text-cyan mb-4">MORCEAU {trackIdx + 1} / {total}</div>
              {revealed ? (
                <div>
                  {revealed.imageUrl && <img src={revealed.imageUrl} alt="" className="mx-auto rounded-lg max-h-64 mb-4 shadow-neon-pink" />}
                  <h2 className="font-pixel text-xl md:text-3xl neon-text-gold mb-2">{revealed.title}</h2>
                  <p className="text-xl text-white/80">{revealed.artist}</p>
                  {revealed.sourceName && (
                    <p className="mt-2 text-sm text-white/50">{revealed.sourceType} — {revealed.sourceName}</p>
                  )}
                </div>
              ) : (
                <Equalizer active={playing} bars={24} />
              )}
            </div>

            <div className="card">
              <div className="font-pixel text-xs neon-text-pink mb-3">FILE DE BUZZ</div>
              {buzzes.length === 0 && <p className="text-white/50">—</p>}
              <ol className="space-y-2">
                {buzzes.map(b => (
                  <li key={b.playerId + b.rank} className="flex items-center gap-3 text-xl">
                    <span className="font-pixel text-lg neon-text-gold">#{b.rank}</span>
                    {b.teamColor && <span className="w-3 h-3 rounded-full" style={{ background: b.teamColor }} />}
                    <span className={b.validated === false ? 'line-through text-white/40' : ''}>{b.pseudo}</span>
                    {b.teamName && <span className="text-sm text-white/40">({b.teamName})</span>}
                    {b.validated === true && <span className="text-green-400 text-xl">✓</span>}
                  </li>
                ))}
              </ol>
            </div>
          </div>

          <Scoreboard teams={scores.teams} players={scores.players} mode={game.mode} />
        </section>
      )}

      {!isWaiting && !isFinished && (
        <aside className="fixed bottom-6 right-6 z-20 card !p-4 flex items-center gap-4 bg-bg-soft/95 backdrop-blur">
          <QrCode value={urlRef.current} size={120} />
          <div className="text-left">
            <div className="font-pixel text-[10px] neon-text-cyan mb-1">REJOINDRE</div>
            <div className="text-xs text-white/70 max-w-[180px] break-all">{urlRef.current}</div>
          </div>
        </aside>
      )}
    </main>
  );
}
