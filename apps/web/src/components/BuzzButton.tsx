'use client';

export function BuzzButton({
  onBuzz,
  disabled,
  state,
}: {
  onBuzz: () => void;
  disabled?: boolean;
  state: 'idle' | 'waiting' | 'correct' | 'wrong' | 'locked';
}) {
  const labels: Record<typeof state, string> = {
    idle: 'BUZZ !',
    waiting: 'EN ATTENTE',
    correct: 'BRAVO !',
    wrong: 'RATÉ',
    locked: 'VERROUILLÉ',
  };
  const colors: Record<typeof state, string> = {
    idle: 'from-neon-pink to-neon-violet shadow-neon-pink',
    waiting: 'from-neon-cyan to-neon-violet shadow-neon-cyan',
    correct: 'from-neon-gold to-neon-pink shadow-neon-gold',
    wrong: 'from-red-600 to-red-900',
    locked: 'from-gray-600 to-gray-800',
  };
  return (
    <button
      onClick={onBuzz}
      disabled={disabled}
      className={`
        w-[75vw] h-[75vw] max-w-[420px] max-h-[420px]
        rounded-full font-pixel text-xl md:text-3xl text-white
        bg-gradient-to-br ${colors[state]}
        transition-transform active:scale-95
        ${state === 'idle' && !disabled ? 'animate-pulse-neon' : ''}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
    >
      {labels[state]}
    </button>
  );
}
