import { leerEnvioPublico, registrarEnvioPublico } from '../captacion-publica';
import { validarCasaOfrecida } from '../validar-casa-ofrecida';

export async function POST(request: Request) {
  const body = await leerEnvioPublico(request).catch(() => null);
  if (body?.sitio_web) return Response.json({ ok: true }, { status: 201 });
  let ficha;
  try {
    ficha = validarCasaOfrecida(body);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Revisa los datos de la casa.' }, { status: 400 });
  }

  return registrarEnvioPublico('casa', ficha);
}
