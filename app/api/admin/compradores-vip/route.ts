import { respuestaFallo } from '../../../../lib/diagnostico';
import { rejectUnauthorizedAdmin, supabaseAdmin } from '../../admin-access';

export async function GET(request: Request) {
  const denied = await rejectUnauthorizedAdmin(request);
  if (denied) return denied;

  const pagina = Number(new URL(request.url).searchParams.get('pagina') ?? '0');
  if (!Number.isSafeInteger(pagina) || pagina < 0 || pagina > 1000000) {
    return Response.json({ error: 'Página inválida' }, { status: 400 });
  }

  const limite = 50;
  const inicio = pagina * limite;
  const { data, error } = await supabaseAdmin.from('leads_compradores')
    .select('id,nombre,whatsapp,perfil,tiene_itin')
    .order('created_at', { ascending: false, nullsFirst: false })
    .order('id', { ascending: false })
    .range(inicio, inicio + limite);

  if (error) return respuestaFallo('vip.consultar', error);

  return Response.json({ compradores: data.slice(0, limite), hayMas: data.length > limite }, {
    headers: { 'Cache-Control': 'private, no-store' },
  });
}
