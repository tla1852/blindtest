import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 relative z-10">
      <h1 className="font-pixel text-3xl md:text-5xl neon-text-pink text-center mb-4">
        RETRO<span className="neon-text-cyan">BUZZ</span>
      </h1>
      <p className="text-white/70 max-w-md text-center mb-10">
        Blind test musical interactif — esthétique rétro-arcade années 90-2000.
        L'animateur lance la musique, les joueurs buzzent depuis leur smartphone.
      </p>
      <div className="flex flex-col sm:flex-row gap-4">
        <Link href="/admin" className="font-pixel text-xs px-6 py-4 rounded-lg border-2 border-neon-violet text-neon-violet hover:bg-neon-violet/20 transition shadow-neon-violet">
          ANIMATEUR
        </Link>
        <a href="#" className="font-pixel text-xs px-6 py-4 rounded-lg border-2 border-neon-cyan text-neon-cyan opacity-60 cursor-not-allowed">
          SCANNER UN QR
        </a>
      </div>
      <footer className="absolute bottom-4 text-white/30 text-xs font-pixel">v0.1.0</footer>
    </main>
  );
}
