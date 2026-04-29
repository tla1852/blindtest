'use client';

type TeamScore = { teamId: string; name: string; color: string; points: number };
type PlayerScore = { playerId: string; pseudo: string; points: number };

export function Scoreboard({
  teams,
  players,
  mode,
}: {
  teams?: TeamScore[];
  players?: PlayerScore[];
  mode: 'FFA' | 'TDM';
}) {
  const list = mode === 'TDM' ? (teams ?? []) : (players ?? []);
  return (
    <div className="card">
      <h3 className="font-pixel text-xs neon-text-gold mb-3">CLASSEMENT</h3>
      {list.length === 0 && <p className="text-white/50 text-sm">Aucun point marqué</p>}
      <ol className="space-y-2">
        {list.map((e: any, i) => (
          <li key={e.teamId ?? e.playerId} className="flex items-center gap-3">
            <span className="font-pixel text-xs neon-text-gold w-6">#{i + 1}</span>
            {mode === 'TDM' && <span className="w-3 h-3 rounded-full" style={{ background: e.color }} />}
            <span className="flex-1 truncate">{e.name ?? e.pseudo}</span>
            <span className="font-pixel text-sm neon-text-cyan">{e.points}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
