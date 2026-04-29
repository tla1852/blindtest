'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { Scoreboard } from '@/components/Scoreboard';

type Buzz = {
  playerId: string; pseudo: string;
  teamId: string | null; teamName: string | null; teamColor: string | null;
  timestampClient: number; timestampServer: number; rank: number; validated: boolean | null;
};

// ====================================================================
// Écran animateur — CDC §4.2 / §3.4
//
// L'audio est joué nativement dans la page via un <audio> HTML5 : on
// charge le fichier local indiqué par `track.filePath` (préférable, cf
// CDC §3.4) ou à défaut `track.previewUrl`. L'animateur peut aussi
// charger un fichier manuellement depuis son disque via file picker.
//
// NB : la cible long terme est une app Electron Windows (CDC §3.3).
// Cette version web fait office de pilotage provisoire.
// ====================================================================

export default function AdminGame() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [game, setGame] = useState<any>(null);
  const [trackIdx, setTrackIdx] = useState(0);
  const [buzzes, setBuzzes] = useState<Buzz[]>([]);
  const [scores, setScores] = useState<any>({ teams: [], players: [] });
  const [playing, setPlaying] = useState(false);
  const [audioErr, setAudioErr] = useState<string | null>(null);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<any>(null);
  const socketRef = useRef<ReturnType<typeof getSocket> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const filePickerRef = useRef<HTMLInputElement | null>(null);

  const currentTrack = useMemo(
    () => game?.playlist?.tracks?.[trackIdx],
    [game, trackIdx]
  );

  useEffect(() => { api(`/api/games/${id}`).then(g => { setGame(g); setTrackIdx(g.currentTrackIdx ?? 0); }); }, [id]);

  useEffect(() => {
    const s = getSocket(); socketRef.current = s;
    s.emit('admin:join', { gameId: id });

    s.on('player:buzz', (b: Buzz) => setBuzzes(q => [...q, b]));
    s.on('buzz:validate', ({ playerId, correct }: any) => {
      setBuzzes(q => q.map(b => b.playerId === playerId ? { ...b, validated: correct } : b));
    });
    s.on('score:update', ({ scores }: any) => setScores(scores));
    // Auto-pause côté serveur (buzz 1er joueur) → coupe aussi le lecteur local
    s.on('track:pause', () => { pauseLocal(); });
    s.on('track:resume', () => { resumeLocal(); });
    s.on('player:joined', () => api(`/api/games/${id}`).then(setGame));

    api(`/api/games/${id}/scores`).then(setScores);
    return () => { s.off('player:buzz'); s.off('buzz:validate'); s.off('score:update'); s.off('track:pause'); s.off('track:resume'); s.off('player:joined'); };
  }, [id]);

  // Prépare la source audio pour le morceau en cours (previewUrl ; filePath
  // local doit être chargé manuellement via le file picker car le navigateur
  // n'a pas accès direct au système de fichiers).
  useEffect(() => {
    if (!currentTrack) return;
    setAudioErr(null);
    setRevealed(null);
    // Ne pas écraser un blob: URL chargé manuellement pour ce track (même index)
    setAudioSrc(prev => prev?.startsWith('blob:') ? prev : (currentTrack.previewUrl ?? null));
    setPlaying(false);
  }, [currentTrack?.id]);

  async function playLocal() {
    const el = audioRef.current;
    if (!el || !audioSrc) {
      setAudioErr("Aucune source audio disponible pour ce morceau. Charge un fichier local ou ajoute une preview.");
      return;
    }
    try { await el.play(); setPlaying(true); }
    catch (e: any) { setAudioErr(e?.message ?? 'Lecture impossible'); }
  }

  function pauseLocal() {
    audioRef.current?.pause();
    setPlaying(false);
  }

  async function resumeLocal() {
    const el = audioRef.current;
    if (!el) return;
    try { await el.play(); setPlaying(true); }
    catch (e: any) { setAudioErr(e?.message ?? 'Reprise impossible'); }
  }

  function onFilePicked(ev: React.ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0];
    if (!file) return;
    if (audioSrc?.startsWith('blob:')) URL.revokeObjectURL(audioSrc);
    setAudioSrc(URL.createObjectURL(file));
    setAudioErr(null);
    ev.target.value = '';
  }

  function startGame() {
    socketRef.current?.emit('game:start', { gameId: id });
    setTrackIdx(0);
  }

  async function play() {
    setAudioErr(null);
    await playLocal();
    socketRef.current?.emit('track:play', { gameId: id, trackIndex: trackIdx });
  }

  async function pause() {
    pauseLocal();
    socketRef.current?.emit('track:pause', { gameId: id, reason: 'manual' });
  }

  async function resume() {
    await resumeLocal();
    socketRef.current?.emit('track:resume', { gameId: id });
  }

  function validate(playerId: string, correct: boolean, bonus: number = 0) {
    if (!currentTrack) return;
    socketRef.current?.emit('buzz:validate', {
      gameId: id, trackId: currentTrack.id, playerId, correct, bonusPoints: bonus,
    });
    if (correct) reveal();
  }

  function reveal() {
    if (!currentTrack) return;
    socketRef.current?.emit('track:reveal', { gameId: id, trackId: currentTrack.id });
    setRevealed(currentTrack);
    pauseLocal();
  }

  function endGame() {
    if (!confirm('Arrêter définitivement la partie en cours ?')) return;
    socketRef.current?.emit('game:end', { gameId: id });
    router.push('/admin');
  }

  function nextTrack() {
    if (!game || !currentTrack) return;
    const next = trackIdx + 1;
    pauseLocal();
    if (audioSrc?.startsWith('blob:')) URL.revokeObjectURL(audioSrc);
    setAudioSrc(null);
    setAudioErr(null);
    socketRef.current?.emit('track:reset', { gameId: id, trackId: currentTrack.id });
    setBuzzes([]); setRevealed(null);
    if (next >= game.playlist.tracks.length) {
      socketRef.current?.emit('game:end', { gameId: id });
      return;
    }
    setTrackIdx(next);
    socketRef.current?.emit('track:next', { gameId: id, trackIndex: next });
  }

  if (!game) return <div className="p-10 font-pixel text-xs neon-text-cyan">Chargement…</div>;

  const displayUrl = typeof window !== 'undefined' ? `${window.location.origin}/display/${id}` : '';
  const playUrl = typeof window !== 'undefined' ? `${window.location.origin}/play/${id}` : '';

  return (
    <main className="min-h-screen relative z-10 p-4 md:p-8 max-w-7xl mx-auto">
      <header className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="font-pixel text-sm md:text-lg neon-text-pink">
          {game.playlist?.name ?? 'Partie'}
        </h1>
        <div className="flex gap-2 text-xs">
          <a href={displayUrl} target="_blank" rel="noopener" className="px-3 py-2 rounded border border-neon-cyan text-neon-cyan">Ouvrir l'écran présentation</a>
          <a href={playUrl} target="_blank" rel="noopener" className="px-3 py-2 rounded border border-neon-pink text-neon-pink">URL joueurs</a>
          <button onClick={endGame} className="px-3 py-2 rounded border border-red-500 text-red-400 hover:bg-red-500/20">ARRÊTER LA PARTIE</button>
        </div>
      </header>

      {/* Lecteur audio natif — non visible (contrôlé par les boutons) */}
      <audio
        ref={audioRef}
        src={audioSrc ?? undefined}
        onEnded={() => setPlaying(false)}
        onError={() => setAudioErr("Erreur du lecteur audio (fichier introuvable ou format non supporté)")}
      />

      {audioErr && (
        <div className="card mb-6 border-red-500 border-2">
          <p className="font-pixel text-xs text-red-400 mb-2">LECTEUR AUDIO — ERREUR</p>
          <p className="text-sm text-white/80">{audioErr}</p>
        </div>
      )}

      {game.status === 'waiting' && (
        <div className="card mb-6 text-center">
          <p className="text-white/70 mb-3">Partie en attente — {game.players.length} joueur(s) connecté(s)</p>
          <button onClick={startGame} className="font-pixel text-xs px-8 py-4 rounded border-2 border-neon-pink text-neon-pink shadow-neon-pink">
            LANCER LA PARTIE
          </button>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Col 1 : Track + contrôles */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <div className="font-pixel text-xs neon-text-cyan">MORCEAU {trackIdx + 1} / {game.playlist.tracks.length}</div>
              {currentTrack?.hasBonus && <span className="font-pixel text-xs neon-text-gold">★ POINT BONUS</span>}
            </div>
            {currentTrack && (
              <>
                <h2 className="font-pixel text-base mb-2">{revealed ? currentTrack.title : '— caché —'}</h2>
                <p className="text-white/60 text-sm mb-4">{revealed ? currentTrack.artist : '—'}</p>

                <div className="mb-4 text-xs text-white/60 space-y-1">
                  {currentTrack.filePath && <div>📁 <code>{currentTrack.filePath}</code> (charger manuellement le fichier)</div>}
                  {audioSrc?.startsWith('blob:') && <div className="text-neon-cyan">✓ Fichier local chargé</div>}
                  {!audioSrc && !currentTrack.filePath && !currentTrack.previewUrl && (
                    <div className="text-yellow-400">⚠ Pas de source audio — charge un fichier</div>
                  )}
                  <input
                    ref={filePickerRef}
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    onChange={onFilePicked}
                  />
                  <button
                    onClick={() => filePickerRef.current?.click()}
                    className="text-xs underline hover:text-neon-cyan"
                  >
                    Charger un fichier audio…
                  </button>
                </div>

                {currentTrack.hints.length > 0 && (
                  <div className="mb-4">
                    <div className="font-pixel text-xs neon-text-violet mb-2">INDICES</div>
                    <ul className="text-sm text-white/80 space-y-1">
                      {currentTrack.hints.map((h: any) => <li key={h.id}>• {h.hintText}</li>)}
                    </ul>
                  </div>
                )}
                <div className="flex flex-wrap gap-3">
                  {!playing
                    ? <button onClick={play} disabled={!audioSrc} className="font-pixel text-xs px-6 py-3 rounded border-2 border-neon-pink text-neon-pink shadow-neon-pink disabled:opacity-40">▶ PLAY</button>
                    : <button onClick={pause} className="font-pixel text-xs px-6 py-3 rounded border-2 border-neon-cyan text-neon-cyan shadow-neon-cyan">⏸ PAUSE</button>}
                  <button onClick={resume} disabled={playing || !audioSrc} className="font-pixel text-xs px-6 py-3 rounded border border-white/20 disabled:opacity-40">⏯ REPRENDRE</button>
                  <button onClick={reveal} className="font-pixel text-xs px-6 py-3 rounded border border-neon-violet text-neon-violet">RÉVÉLER</button>
                  <button onClick={nextTrack} className="font-pixel text-xs px-6 py-3 rounded border-2 border-neon-gold text-neon-gold shadow-neon-gold">SUIVANT →</button>
                </div>
              </>
            )}
          </div>

          <div className="card">
            <div className="font-pixel text-xs neon-text-pink mb-3">FILE DE BUZZ</div>
            {buzzes.length === 0 && <p className="text-white/50 text-sm">Personne n'a buzzé pour l'instant</p>}
            <ol className="space-y-2">
              {buzzes.map(b => (
                <li key={b.playerId + b.rank} className="flex items-center gap-3 p-3 rounded bg-white/5">
                  <span className="font-pixel text-sm neon-text-gold w-8">#{b.rank}</span>
                  {b.teamColor && <span className="w-3 h-3 rounded-full" style={{ background: b.teamColor }} />}
                  <span className={`flex-1 ${b.validated === false ? 'line-through text-white/40' : ''}`}>
                    <strong>{b.pseudo}</strong>
                    {b.teamName && <span className="text-xs text-white/50 ml-2">({b.teamName})</span>}
                  </span>
                  {b.validated === null && (
                    <div className="flex gap-2">
                      <button onClick={() => validate(b.playerId, true, 0)}
                        className="px-3 py-1 rounded bg-green-600/30 hover:bg-green-600/60 text-sm">✅</button>
                      {currentTrack?.hasBonus && (
                        <button onClick={() => validate(b.playerId, true, 1)}
                          className="px-3 py-1 rounded bg-yellow-500/30 hover:bg-yellow-500/60 text-sm">🌟 +1</button>
                      )}
                      <button onClick={() => validate(b.playerId, false)}
                        className="px-3 py-1 rounded bg-red-600/30 hover:bg-red-600/60 text-sm">❌</button>
                    </div>
                  )}
                  {b.validated === true && <span className="text-green-400 text-sm">✓</span>}
                </li>
              ))}
            </ol>
          </div>
        </div>

        {/* Col 2 : scoreboard + joueurs */}
        <div className="space-y-6">
          <Scoreboard teams={scores.teams} players={scores.players} mode={game.mode} />
          <div className="card">
            <div className="font-pixel text-xs neon-text-cyan mb-3">JOUEURS ({game.players.length})</div>
            <ul className="space-y-1 text-sm max-h-80 overflow-auto">
              {game.players.map((p: any) => (
                <li key={p.id} className="flex items-center gap-2">
                  {p.team && <span className="w-2 h-2 rounded-full" style={{ background: p.team.color }} />}
                  <span>{p.pseudo}</span>
                  {p.team && <span className="text-xs text-white/40">({p.team.name})</span>}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </main>
  );
}
