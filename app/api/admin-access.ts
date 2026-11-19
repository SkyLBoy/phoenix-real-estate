import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const clientOptions = {
  auth: { autoRefreshToken: false, persistSession: false },
};

const supabaseAuth = createClient(
  supabaseUrl,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  clientOptions,
);

export const supabaseAdmin = createClient(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  clientOptions,
);

export async function rejectUnauthorizedAdmin(request: Request): Promise<Response | null> {
  const token = request.headers.get('Authorization')?.match(/^Bearer ([^\s,]+)$/i)?.[1];
  if (!token) {
    return Response.json({ error: 'Inicia sesión para continuar' }, { status: 401 });
  }

  const { data, error } = await supabaseAuth.auth.getUser(token);
  if (error || !data.user) {
    return Response.json({ error: 'La sesión no es válida' }, { status: 401 });
  }

  const allowedIds = (process.env.ADMIN_USER_IDS ?? '').split(',').map((id) => id.trim());
  if (!allowedIds.includes(data.user.id)) {
    return Response.json({ error: 'Tu cuenta no tiene acceso al panel' }, { status: 403 });
  }

  return null;
}
