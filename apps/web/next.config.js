/** @type {import('next').NextConfig} */
// 127.0.0.1 explicite (pas localhost) pour éviter la résolution IPv6 ::1 → ECONNREFUSED
const API_INTERNAL = process.env.INTERNAL_API_URL ?? 'http://127.0.0.1:4000';

const nextConfig = {
  reactStrictMode: true,
  images: { remotePatterns: [{ protocol: 'https', hostname: '**' }] },
  output: 'standalone',
  // IMPORTANT : Next normalise les trailing slashes par défaut, ce qui casse
  // la requête polling de socket.io-client (`/socket.io/?EIO=4...` devient
  // `/socket.io?EIO=4...` avant d'atteindre le rewrite → engine.io ne matche
  // plus et Fastify répond 404).
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${API_INTERNAL}/api/:path*` },
      // Les deux variantes (avec/sans slash, avec/sans sous-chemin) pour couvrir
      // tous les cas de figure (polling long-poll, handshake, etc.).
      { source: '/socket.io', destination: `${API_INTERNAL}/socket.io/` },
      { source: '/socket.io/', destination: `${API_INTERNAL}/socket.io/` },
      { source: '/socket.io/:path*', destination: `${API_INTERNAL}/socket.io/:path*` },
    ];
  },
};
module.exports = nextConfig;
