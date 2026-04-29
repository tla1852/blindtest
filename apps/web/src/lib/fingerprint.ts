'use client';

// Fingerprint minimaliste (non cryptographique) pour limiter le
// multi-buzz depuis un même device — CDC §9.2.
// Un id stable est stocké dans localStorage, complété par quelques signaux navigateur.

export function deviceFingerprint(): string {
  if (typeof window === 'undefined') return 'ssr';
  const existing = localStorage.getItem('rb_device');
  if (existing) return existing;
  const parts = [
    navigator.userAgent,
    navigator.language,
    screen.width + 'x' + screen.height,
    new Date().getTimezoneOffset(),
    crypto.randomUUID(),
  ];
  const id = btoa(parts.join('|')).slice(0, 40);
  localStorage.setItem('rb_device', id);
  return id;
}
