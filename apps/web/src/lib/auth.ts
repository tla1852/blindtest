'use client';

export type AuthUser = { id: string; email: string; displayName: string };

export function saveAuth(token: string, refreshToken: string, user: AuthUser) {
  localStorage.setItem('rb_token', token);
  localStorage.setItem('rb_refresh', refreshToken);
  localStorage.setItem('rb_user', JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem('rb_token');
  localStorage.removeItem('rb_refresh');
  localStorage.removeItem('rb_user');
}

export function getUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('rb_user');
  return raw ? (JSON.parse(raw) as AuthUser) : null;
}
