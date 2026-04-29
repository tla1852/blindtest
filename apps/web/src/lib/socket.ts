'use client';

import { io, Socket } from 'socket.io-client';

// Vide = même origine (transite par le rewrite Next.js /socket.io/*)
const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? '';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (socket && socket.connected) return socket;
  const opts: any = {
    // Polling en premier : c'est ce qui traverse le rewrite Next.js. Le WS
    // upgrade ne fonctionnera QUE si Synology reverse-proxy route /socket.io/
    // en direct vers :4000 avec "WebSocket" activé. Si ce n'est pas le cas,
    // la connexion reste en long-polling (fonctionnel mais plus lent).
    transports: ['polling', 'websocket'],
    path: '/socket.io/',
    // Reconnexion avec backoff exponentiel (1s, 2s, 4s, 8s, max 30s) — CDC §9.4
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 30000,
    randomizationFactor: 0.5,
  };
  socket = WS_URL ? io(WS_URL, opts) : io(opts);
  return socket;
}

export function closeSocket() {
  socket?.disconnect();
  socket = null;
}
