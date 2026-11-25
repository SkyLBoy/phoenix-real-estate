import { normalizarWhatsApp, perfilesVip } from '../../../lib/compradores-vip';
import { leerEnvioPublico, registrarEnvioPublico } from '../captacion-publica';

export async function POST(request: Request) {
  const body = await leerEnvioPublico(request).catch(() => null);
  if (body?.sitio_web) return Response.json({ ok: true }, { status: 201 });
  const nombre = typeof body?.nombre === 'string' ? body.nombre.trim() : '';
  const whatsapp = normalizarWhatsApp(body?.whatsapp, body?.pais);
  const perfil = body?.perfil;
  const tiene_itin = body?.tiene_itin;

  if (!nombre || nombre.length > 120 || !whatsapp
    || typeof perfil !== 'string' || !Object.hasOwn(perfilesVip, perfil)
    || typeof tiene_itin !== 'boolean') {
    return Response.json({
      error: 'Revisa tu nombre, perfil y número de WhatsApp. Elige el país y escribe los 10 dígitos de tu número.',
    }, { status: 400 });
  }

  return registrarEnvioPublico('vip', { nombre, whatsapp, perfil, tiene_itin });
}
