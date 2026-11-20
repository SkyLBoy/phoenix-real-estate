import { etiquetaDisponibilidad, type EstadoDisponibilidad } from './disponibilidad';
import { supabase } from './supabase';

type FichaAviso = {
  ciudad_zona: string;
  precio: number;
  estado: EstadoDisponibilidad;
  ultima_confirmacion: string | null;
};

export async function cargarFichasDelAviso(): Promise<FichaAviso[]> {
  const fichas: FichaAviso[] = [];
  const porPagina = 100;
  for (let inicio = 0; ; inicio += porPagina) {
    const { data, error } = await supabase.from('propiedades_publicas')
      .select('ciudad_zona,precio,estado,ultima_confirmacion')
      .eq('estado', 'disponible')
      .order('created_at', { ascending: false })
      .order('id')
      .range(inicio, inicio + porPagina - 1);
    if (error) throw new Error('No se pudo consultar el catálogo. Vuelve a preparar el aviso.');
    fichas.push(...data);
    if (data.length < porPagina) return fichas;
  }
}

const precioUsd = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

export function prepararAvisoWhatsApp(fichas: FichaAviso[], origen: string, ahora: number | null) {
  const confirmadas: string[] = [];
  const porConfirmar: string[] = [];

  for (const ficha of fichas) {
    if (ficha.estado !== 'disponible') continue;
    const zona = ficha.ciudad_zona.replace(/\s+/g, ' ').trim();
    const precio = precioUsd.format(ficha.precio);
    const pendiente = etiquetaDisponibilidad(ficha.estado, ficha.ultima_confirmacion, ahora) === 'Por confirmar';
    const fila = `• ${zona} — $${precio} USD`;
    if (pendiente) porConfirmar.push(`${fila} (Por confirmar)`);
    else confirmadas.push(fila);
  }
  if (!confirmadas.length && !porConfirmar.length) return '';

  const enlace = new URL('/', origen).href;
  return [
    '🏡 *Propiedades del día*',
    [...confirmadas, ...porConfirmar].join('\n'),
    `Ver catálogo y fotos: ${enlace}`,
  ].join('\n\n');
}
