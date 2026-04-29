'use client';

export function Equalizer({ active = true, bars = 16 }: { active?: boolean; bars?: number }) {
  return (
    <div className="flex items-end justify-center gap-1 h-24" aria-hidden>
      {Array.from({ length: bars }).map((_, i) => (
        <span
          key={i}
          className={`w-2 rounded-t bg-gradient-to-t from-neon-violet via-neon-pink to-neon-cyan ${active ? 'animate-pulse' : 'opacity-30'}`}
          style={{
            height: active ? `${30 + Math.random() * 70}%` : '20%',
            animationDelay: `${i * 60}ms`,
            animationDuration: `${500 + (i % 4) * 120}ms`,
          }}
        />
      ))}
    </div>
  );
}
