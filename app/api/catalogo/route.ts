import { supabase } from '../../../lib/supabase';
import { CAMPOS_PUBLICOS } from '../../../lib/propiedades-publicas';
import { ciudadesPhoenix } from '../../../lib/ciudades-phoenix';
import { registrarFallo, respuestaFallo } from '../../../lib/diagnostico';

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
  const filtrar = <T extends string>(campos: T, contar = false) => {
    let consulta = supabase.from('propiedades_publicas').select(campos, contar ? { count: 'exact' } : {}).eq('estado', 'disponible');
    if (ciudad) consulta = consulta.eq('ciudad', ciudad);
    if (zip) consulta = consulta.like('zip', `${zip}%`);
    return consulta;
  };
  const [{ data, error, count }, minimo] = await Promise.all([
    filtrar(CAMPOS_PUBLICOS, true).order('created_at', { ascending: false }).order('id')
      .range(pagina * porPagina, (pagina + 1) * porPagina - 1),
    filtrar('precio').not('precio', 'is', null).order('precio', { ascending: true }).limit(1),
  ]);
  if (minimo.error) registrarFallo('catalogo.resumen', minimo.error);
  const precioDesde = minimo.error || !minimo.data?.length ? null : Number(minimo.data[0].precio);
  if (error) return respuestaFallo('catalogo.listar', error, 'No pudimos cargar las propiedades.');
  return Response.json({ propiedades: data, total: count ?? 0, pagina, porPagina, precioDesde }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
