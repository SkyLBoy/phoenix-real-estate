import { normalizarWhatsApp, perfilesVip } from '../../../lib/compradores-vip';
import { supabaseAdmin } from '../admin-access';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const nombre = typeof body?.nombre === 'string' ? body.nombre.trim() : '';
  const whatsapp = normalizarWhatsApp(body?.whatsapp);
  const perfil = body?.perfil;
  const tiene_itin = body?.tiene_itin;

  if (!nombre || nombre.length > 120 || !whatsapp
    || typeof perfil !== 'string' || !Object.hasOwn(perfilesVip, perfil)
    || typeof tiene_itin !== 'boolean') {
    return Response.json({
      error: 'Revisa tu nombre, perfil y número de WhatsApp. Para números fuera de EE. UU., incluye + y el código de país.',
    }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from('leads_compradores')
    .insert({ nombre, whatsapp, perfil, tiene_itin });
  if (error) return Response.json({ error: 'No se pudo guardar el registro. Intenta de nuevo.' }, { status: 500 });

  return Response.json({ ok: true }, { status: 201 });
}
