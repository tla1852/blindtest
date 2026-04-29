// Construit toujours une URL absolue à partir de l'origine courante
// pour éviter toute ambiguïté de résolution relative.
function buildUrl(path: string): string {
  const envBase = process.env.NEXT_PUBLIC_API_URL;
  if (envBase) {
    return `${envBase.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
  }
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/${path.replace(/^\//, '')}`;
  }
  return `/${path.replace(/^\//, '')}`;
}

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('rb_token');
}

export async function api<T = any>(
  path: string,
  opts: RequestInit & { auth?: boolean } = {}
): Promise<T> {
  const { auth = true, headers, ...rest } = opts;
  const h: Record<string, string> = { ...(headers as any) };
  // Ne définit Content-Type que quand il y a un body — sinon Fastify rejette
  // avec FST_ERR_CTP_EMPTY_JSON_BODY sur les requêtes DELETE sans corps.
  if (rest.body != null && !h['Content-Type'] && !h['content-type']) {
    h['Content-Type'] = 'application/json';
  }
  if (auth) {
    const t = getToken();
    if (t) h.Authorization = `Bearer ${t}`;
  }
  const url = buildUrl(path);
  const res = await fetch(url, { ...rest, headers: h });
  // Token périmé/invalide : on purge la session et on renvoie vers le login.
  // On ne redirige pas pendant le flow de login lui-même (auth === false).
  if (res.status === 401 && auth && typeof window !== 'undefined') {
    localStorage.removeItem('rb_token');
    localStorage.removeItem('rb_refresh');
    localStorage.removeItem('rb_user');
    if (!window.location.pathname.startsWith('/admin/login')) {
      window.location.href = '/admin/login';
    }
    throw new Error('Session expirée — merci de vous reconnecter');
  }
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as any;
  return res.json();
}

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';
