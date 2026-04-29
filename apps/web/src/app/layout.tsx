import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'RetroBuzz — Blind test Bar',
  description: 'Blind test musical interactif, esthétique rétro-arcade 90-2000',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Outfit:wght@300;400;600;700;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-bg text-white font-sans antialiased">
        <div className="fixed inset-0 pointer-events-none z-0 opacity-[0.04] bg-[linear-gradient(to_bottom,transparent_50%,#fff_50%)] bg-[length:100%_4px]" />
        {children}
      </body>
    </html>
  );
}
