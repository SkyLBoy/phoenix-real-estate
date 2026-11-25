import { supabase } from '../../../lib/supabase';
import { CAMPOS_PUBLICOS } from '../../../lib/propiedades-publicas';
import { ciudadesPhoenix } from '../../../lib/ciudades-phoenix';
import { respuestaFallo } from '../../../lib/diagnostico';

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const ciudad = params.get('ciudad') ?? '';
  const zip = params.get('zip') ?? '';
  const pagina = Number(params.get('pagina') ?? 0);
  if ((ciudad && !ciudadesPhoenix.some((opcion) => opcion === ciudad)) || !/^\d{0,5}$/.test(zip)
    || !Number.isSafeInteger(pagina) || pagina < 0 || pagina > 100000) {
    return Response.json({ error: 'Revisa los filtros del catálogo.' }, { status: 400 });
  }
  const porPagina = 12;
  let consulta = supabase.from('propiedades_publicas').select(CAMPOS_PUBLICOS, { count: 'exact' }).eq('estado', 'disponible');
  if (ciudad) consulta = consulta.eq('ciudad', ciudad);
  if (zip) consulta = consulta.like('zip', `${zip}%`);
  const { data, error, count } = await consulta.order('created_at', { ascending: false }).order('id')
    .range(pagina * porPagina, (pagina + 1) * porPagina - 1);
  if (error) return respuestaFallo('catalogo.listar', error, 'No pudimos cargar las propiedades.');
  return Response.json({ propiedades: data, total: count ?? 0, pagina, porPagina }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
