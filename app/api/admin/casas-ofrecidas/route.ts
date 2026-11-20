import { estadosOferta } from '../../../../lib/casas-ofrecidas';
import { validarCasaOfrecida } from '../../validar-casa-ofrecida';
import { rejectUnauthorizedAdmin, supabaseAdmin } from '../../admin-access';

const campos = 'id,nombre,whatsapp,zona,condicion,precio_esperado,plazo,fotos_url,notas,estado';
const limite = 25;
const privado = { 'Cache-Control': 'private, no-store' };

function fallo(error: string, status: number) {
  return Response.json({ error }, { status, headers: privado });
}

export async function GET(request: Request) {
  const denegado = await rejectUnauthorizedAdmin(request);
  if (denegado) return denegado;

  const pagina = Number(new URL(request.url).searchParams.get('pagina') ?? '0');
  if (!Number.isSafeInteger(pagina) || pagina < 0 || pagina > 1_000_000) return fallo('Página inválida.', 400);
  const inicio = pagina * limite;
  const { data, error } = await supabaseAdmin.from('casas_ofrecidas').select(campos)
    .order('created_at', { ascending: false }).order('id', { ascending: false })
    .range(inicio, inicio + limite);
  if (error) return fallo('No se pudieron cargar las casas ofrecidas.', 500);
  return Response.json({ casas: data.slice(0, limite), hayMas: data.length > limite }, { headers: privado });
}

export async function POST(request: Request) {
  const denegado = await rejectUnauthorizedAdmin(request);
  if (denegado) return denegado;

  const body = await request.json().catch(() => null);
  let ficha;
  try {
    ficha = validarCasaOfrecida(body);
  } catch (error) {
    return fallo(error instanceof Error ? error.message : 'Revisa los datos de la casa.', 400);
  }
  const { data, error } = await supabaseAdmin.from('casas_ofrecidas').insert(ficha).select(campos).single();
  if (error) return fallo('No se pudo guardar la casa ofrecida.', 500);
  return Response.json({ casa: data }, { status: 201, headers: privado });
}

export async function PATCH(request: Request) {
  const denegado = await rejectUnauthorizedAdmin(request);
  if (denegado) return denegado;

  const body = await request.json().catch(() => null);
  if (typeof body?.id !== 'string' || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(body.id)
    || typeof body.estado !== 'string' || !Object.hasOwn(estadosOferta, body.estado)) {
    return fallo('Identifica la oferta y elige un estado válido.', 400);
  }
  const { data, error } = await supabaseAdmin.from('casas_ofrecidas').update({ estado: body.estado })
    .eq('id', body.id).select(campos).maybeSingle();
  if (error) return fallo('No se pudo actualizar el estado.', 500);
  if (!data) return fallo('La oferta ya no está disponible.', 404);
  return Response.json({ casa: data }, { headers: privado });
}
