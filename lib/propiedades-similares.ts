import { plazoConfirmacion } from './disponibilidad';
import { supabase } from './supabase';
import { esZonaPublica } from './zona-publica';
import type { PropiedadPublica } from './propiedades-publicas';

type Resumen = Pick<PropiedadPublica, 'id' | 'ciudad_zona' | 'precio'>;

function ubicacion(zona: string) {
  const zip = zona.match(/\b(\d{5})(?:-\d{4})?$/)?.[1];
  const ciudad = zona.replace(/[,\s]*\b\d{5}(?:-\d{4})?$/, '')
    .replace(/(?:,\s*|\s+)(Arizona|AZ)$/i, '').trim().toLowerCase();
  return { ciudad, zip };
}

export async function cargarSimilares(referencia: Resumen, ahora = Date.now()): Promise<Resumen[]> {
  if (!esZonaPublica(referencia.ciudad_zona)) return [];
  const { ciudad, zip } = ubicacion(referencia.ciudad_zona);
  const zonas = [ciudad, zip].filter(Boolean)
    .map((valor) => `ciudad_zona.ilike."*${valor}*"`).join(',');
  const desde = new Date(ahora - plazoConfirmacion).toISOString();
  const candidatas: { ficha: Resumen; mismoZip: boolean }[] = [];
  const porPagina = 100;
  for (let inicio = 0; ; inicio += porPagina) {
    const { data, error } = await supabase.from('propiedades_publicas')
      .select('id,ciudad_zona,precio')
      .neq('id', referencia.id).eq('estado', 'disponible').gt('ultima_confirmacion', desde)
      .or(zonas).order('id').range(inicio, inicio + porPagina - 1);
    if (error) return [];
    for (const ficha of data) {
      const zona = ubicacion(ficha.ciudad_zona);
      const mismoZip = Boolean(zip && zona.zip === zip);
      if (mismoZip || (ciudad && zona.ciudad === ciudad)) candidatas.push({ ficha, mismoZip });
    }
    if (data.length < porPagina) break;
  }
  return candidatas.sort((a, b) => Number(b.mismoZip) - Number(a.mismoZip)
    || Math.abs(a.ficha.precio - referencia.precio) - Math.abs(b.ficha.precio - referencia.precio))
    .slice(0, 2).map(({ ficha }) => ficha);
}
