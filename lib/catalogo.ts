import { registrarFallo } from './diagnostico';
import { CAMPOS_PUBLICOS } from './propiedades-publicas';
import { supabase } from './supabase';

export async function cargarCatalogo({ ciudad = '', zip = '', pagina = 0 } = {}) {
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
  if (error) return { error, datos: null };
  return { error: null, datos: { propiedades: data, total: count ?? 0, pagina, porPagina, precioDesde } };
}

export type PaginaCatalogo = NonNullable<Awaited<ReturnType<typeof cargarCatalogo>>['datos']>;
