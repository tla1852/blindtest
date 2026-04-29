'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { BuzzButton } from '@/components/BuzzButton';
import { deviceFingerprint } from '@/lib/fingerprint';

type Phase = 'lobby' | 'waiting' | 'playing' | 'buzzed' | 'revealed' | 'ended';

export default function Play() {
  const { id } = useParams<{ id: string }>();
  const [game, setGame] = useState<any>(null);
  const [pseudo, setPseudo] = useState('');
  const [teamId, setTeamId] = useState<string>('');
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('lobby');
  const [trackIdx, setTrackIdx] = useState(0);
  const [total, setTotal] = useState(0);
  const [revealed, setRevealed] = useState<any>(null);
  const [playStartTs, setPlayStartTs] = useState<number | null>(null);
  const [delayRemaining, setDelayRemaining] = useState(0);
  const [result, setResult] = useState<'correct' | 'wrong' | null>(null);
  const [teamScoreLabel, setTeamScoreLabel] = useState<string>('');
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function clearCountdown() {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }

  // Cleanup de l'interval au démontage
  useEffect(() => () => clearCountdown(), []);

  // Reprise si déjà connecté
  useEffect(() => {
    api(`/api/games/${id}`).then((g: any) => {
      setGame(g); setTotal(g.playlist?.tracks?.length ?? 0); setTrackIdx(g.currentTrackIdx ?? 0);
    });
    const stored = localStorage.getItem(`rb_player_${id}`);
    if (stored) {
      const { playerId: pid, pseudo: ps, teamId: tid } = JSON.parse(stored);
      setPseudo(ps); setTeamId(tid ?? ''); setPlayerId(pid);
      const s = getSocket();
      s.emit('player:rejoin', { gameId: id, playerId: pid }, (resp: any) => {
        if (resp?.ok) {
          setPhase(resp.status === 'playing' ? 'waiting' : resp.status === 'finished' ? 'ended' : 'waiting');
          setTrackIdx(resp.currentTrackIdx ?? 0);
          wireEvents();
        } else {
          localStorage.removeItem(`rb_player_${id}`);
          setPlayerId(null);
          if (resp?.error) {
            console.warn('[rejoin] failed:', resp.error);
          }
        }
      });
    }
  }, [id]);

  function wireEvents() {
    const s = getSocket();
    s.on('game:start', () => { setPhase('waiting'); setRevealed(null); setResult(null); });
    s.on('track:play', ({ trackIndex, serverTs }: any) => {
      clearCountdown();
      setTrackIdx(trackIndex); setPhase('playing'); setRevealed(null); setResult(null);
      setPlayStartTs(serverTs ?? Date.now());
      if (game?.delayBeforeBuzz) {
        setDelayRemaining(game.delayBeforeBuzz);
        countdownRef.current = setInterval(() => {
          setDelayRemaining(d => {
            if (d <= 1) { clearCountdown(); return 0; }
            return d - 1;
          });
        }, 1000);
      } else {
        setDelayRemaining(0);
      }
    });
    s.on('track:pause', () => { /* garder phase */ });
    s.on('track:next', ({ trackIndex }: any) => { clearCountdown(); setDelayRemaining(0); setTrackIdx(trackIndex); setPhase('waiting'); setRevealed(null); setResult(null); });
    s.on('track:reveal', (data: any) => { setRevealed(data); setPhase('revealed'); });
    s.on('buzz:validate', ({ playerId: pid, correct }: any) => {
      if (pid === playerId) { setResult(correct ? 'correct' : 'wrong'); }
    });
    s.on('game:end', () => setPhase('ended'));
  }

  async function join(e: React.FormEvent) {
    e.preventDefault();
    if (!pseudo.trim()) return;
    const s = getSocket();
    s.emit('player:join', {
      gameId: id, pseudo: pseudo.trim(),
      teamId: game.mode === 'TDM' ? (teamId || null) : null,
      deviceFingerprint: deviceFingerprint(),
    }, (resp: any) => {
      if (resp?.error) { alert(resp.error); return; }
      setPlayerId(resp.playerId);
      localStorage.setItem(`rb_player_${id}`, JSON.stringify({ playerId: resp.playerId, pseudo, teamId }));
      setPhase(game.status === 'playing' ? 'waiting' : 'waiting');
      wireEvents();
    });
  }

  function buzz() {
    if (phase !== 'playing' || delayRemaining > 0) return;
    // horodatage côté client = ms depuis le début du morceau (permet de stocker un "reaction time")
    const reactionMs = playStartTs ? Date.now() - playStartTs : 0;
    const s = getSocket();
    s.emit('player:buzz', { timestampClient: reactionMs }, (resp: any) => {
      if (resp?.ok) {
        setPhase('buzzed');
        if (navigator.vibrate) navigator.vibrate([40, 20, 60]);
      } else if (resp?.error) {
        // déjà buzzé / limite équipe — silencieux
      }
    });
  }

  if (!game) return null;

  if (!playerId) {
    return (
      <main className="min-h-screen relative z-10 p-6 flex items-center justify-center">
        <form onSubmit={join} className="card w-full max-w-sm space-y-4">
          <h1 className="font-pixel text-sm neon-text-pink text-center">REJOINDRE</h1>
          <p className="text-center text-white/70 text-sm">{game.playlist?.name}</p>
          <input value={pseudo} onChange={e => setPseudo(e.target.value)} required maxLength={20}
            placeholder="Ton pseudo" autoFocus
            className="w-full bg-bg-soft border border-white/10 rounded px-4 py-3 focus:border-neon-cyan outline-none text-center" />
          {game.mode === 'TDM' && (
            <select value={teamId} onChange={e => setTeamId(e.target.value)} required
              className="w-full bg-bg-soft border border-white/10 rounded px-4 py-3 focus:border-neon-cyan outline-none">
              <option value="">— Choisir une équipe —</option>
              {game.teams.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          )}
          <button className="w-full font-pixel text-xs py-3 rounded border-2 border-neon-pink text-neon-pink hover:bg-neon-pink/20 shadow-neon-pink">
            BUZZER !
          </button>
        </form>
      </main>
    );
  }

  // Écran de jeu principal
  const buzzState = phase === 'playing' && delayRemaining === 0 ? 'idle'
    : phase === 'buzzed' ? 'waiting'
    : result === 'correct' ? 'correct'
    : result === 'wrong' ? 'wrong'
    : 'locked';

  return (
    <main className="min-h-screen relative z-10 flex flex-col p-4 pt-6 items-center">
      <div className="w-full flex items-center justify-between text-xs max-w-md mb-2">
        <span className="font-pixel neon-text-cyan">{pseudo}</span>
        <span className="font-pixel neon-text-gold">#{trackIdx + 1}/{total}</span>
      </div>
      <h1 className="font-pixel text-xs neon-text-pink mb-6 text-center">{game.playlist?.name}</h1>

      {delayRemaining > 0 && (
        <div className="mb-4 font-pixel text-sm neon-text-cyan">Buzz dans {delayRemaining}s…</div>
      )}

      <div className="flex-1 flex items-center justify-center">
        {phase === 'ended' ? (
          <div className="text-center">
            <h2 className="font-pixel text-xl neon-text-gold mb-2">FIN DE PARTIE</h2>
            <p className="text-white/70">Merci d'avoir joué !</p>
          </div>
        ) : phase === 'revealed' && revealed ? (
          <div className="text-center">
            {revealed.imageUrl && <img src={revealed.imageUrl} alt="" className="mx-auto rounded mb-4 max-h-48" />}
            <h3 className="font-pixel text-sm neon-text-gold mb-1">{revealed.title}</h3>
            <p className="text-white/70">{revealed.artist}</p>
          </div>
        ) : (
          <BuzzButton onBuzz={buzz}
            disabled={phase !== 'playing' || delayRemaining > 0}
            state={buzzState as any} />
        )}
      </div>

      {phase === 'waiting' && (
        <p className="font-pixel text-xs neon-text-cyan text-center mb-4">En attente du prochain morceau…</p>
      )}
    </main>
  );
}
