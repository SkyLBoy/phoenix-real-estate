import { supabaseAdmin } from '../admin-access';
import { validarCasaOfrecida } from '../validar-casa-ofrecida';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  let ficha;
  try {
    ficha = validarCasaOfrecida(body);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Revisa los datos de la casa.' }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from('casas_ofrecidas').insert(ficha);
  if (error) {
    return Response.json({ error: 'No se pudo enviar tu propiedad. Intenta de nuevo.' }, { status: 500 });
  }

  return Response.json({ ok: true }, { status: 201 });
}
