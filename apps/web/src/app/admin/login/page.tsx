'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { saveAuth } from '@/lib/auth';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('admin@retrobuzz.io');
  const [password, setPassword] = useState('retrobuzz');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setLoading(true);
    try {
      const r: any = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }), auth: false });
      saveAuth(r.token, r.refreshToken, r.user);
      router.replace('/admin');
    } catch (e: any) {
      setErr('Identifiants invalides');
    } finally { setLoading(false); }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 relative z-10">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-4">
        <h1 className="font-pixel text-sm neon-text-pink text-center">CONNEXION ANIMATEUR</h1>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
          className="w-full bg-bg-soft border border-white/10 rounded px-4 py-3 focus:border-neon-cyan outline-none" placeholder="Email" />
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
          className="w-full bg-bg-soft border border-white/10 rounded px-4 py-3 focus:border-neon-cyan outline-none" placeholder="Mot de passe" />
        {err && <p className="text-red-400 text-sm text-center">{err}</p>}
        <button disabled={loading} className="w-full font-pixel text-xs py-3 rounded border-2 border-neon-pink text-neon-pink hover:bg-neon-pink/20 shadow-neon-pink disabled:opacity-40">
          {loading ? '...' : 'SE CONNECTER'}
        </button>
        <p className="text-xs text-white/40 text-center">Démo : admin@retrobuzz.io / retrobuzz</p>
      </form>
    </main>
  );
}
