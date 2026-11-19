import { createClient } from '@supabase/supabase-js';

export const supabaseAdminAuth = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { storageKey: 'phoenix-admin-auth' } },
);
