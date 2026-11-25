import { supabaseAdminAuth } from './supabase-admin-auth';

export async function respuestaPrivada(userId: string, url: string, options: RequestInit = {}) {
  const { data: { session } } = await supabaseAdminAuth.auth.getSession();
  if (session?.user.id !== userId) {
    throw new Error('La sesión no es válida', { cause: 401 });
  }

  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${session.access_token}`);
  const response = await fetch(url, { ...options, headers });
  if (response.ok) return response;

  const body = await response.json().catch(() => null);
  throw new Error(body?.error || 'No se pudo completar la operación', { cause: response.status });
}

export async function solicitar<T>(userId: string, url: string, options: RequestInit = {}): Promise<T> {
  return (await respuestaPrivada(userId, url, options)).json();
}

