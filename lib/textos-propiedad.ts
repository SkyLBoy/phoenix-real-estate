import { esZonaPublica } from './zona-publica';

export const textosPropiedad = {
  script_fb_es: 'Facebook en español',
  script_fb_en: 'Facebook en inglés',
  script_wa_vip: 'WhatsApp individual',
  script_filtro_curiosos: 'Respuesta inicial',
} as const;

export type CanalTexto = keyof typeof textosPropiedad;
export const canalesTexto = Object.keys(textosPropiedad) as CanalTexto[];
export const condicionesTexto = {
  contado: 'Compra de contado',
  financiamiento: 'Financiamiento privado',
  itin: 'Acepta ITIN',
  pasaporte: 'Acepta pasaporte',
  arreglos: 'Financiamiento para arreglos',
  habitable: 'Casa habitable',
  paraFlippers: 'Orientada a proyectos Fix & Flip',
  asesoria: 'Ofrece acompañamiento durante el proceso',
  incluirArv: 'Incluir ARV confirmado',
} as const;
export const clavesCondiciones = Object.keys(condicionesTexto) as (keyof typeof condicionesTexto)[];

export const publicosTexto = {
  mixto: 'Compradores de vivienda e inversionistas',
  vivienda: 'Compradores de vivienda',
  inversion: 'Inversionistas',
} as const;

export const rasgosPublicos = {
  piscina: { es: 'Piscina', en: 'Pool' },
  techoNuevo: { es: 'Techo nuevo', en: 'New roof' },
  patioCercado: { es: 'Patio cercado', en: 'Fenced yard' },
  garaje: { es: 'Garaje', en: 'Garage' },
  cocinaRenovada: { es: 'Cocina renovada', en: 'Renovated kitchen' },
  unaPlanta: { es: 'Una sola planta', en: 'Single-story layout' },
} as const;
export type RasgoPublico = keyof typeof rasgosPublicos;
export const clavesRasgos = Object.keys(rasgosPublicos) as RasgoPublico[];

export type CondicionesTexto = Partial<Record<keyof typeof condicionesTexto, boolean>> & {
  enganche?: number;
  publico?: keyof typeof publicosTexto;
  rasgos?: RasgoPublico[];
};

export function mismasCondiciones(a: CondicionesTexto, b: CondicionesTexto) {
  return a.enganche === b.enganche && (a.publico ?? 'mixto') === (b.publico ?? 'mixto')
    && clavesCondiciones.every((campo) => Boolean(a[campo]) === Boolean(b[campo]))
    && clavesRasgos.every((rasgo) => Boolean(a.rasgos?.includes(rasgo)) === Boolean(b.rasgos?.includes(rasgo)));
}

export type TextosFicha = Partial<Record<CanalTexto, string | null>>
  & Partial<Record<`${CanalTexto}_aprobado`, boolean>> & {
    textos_version: number;
    condiciones_texto: CondicionesTexto;
  };

export const MAX_TEXTO = 5000;

export function requisitosTextos(ficha: { ciudad_zona?: unknown; precio?: unknown; estado?: unknown }) {
  const faltantes: string[] = [];
  const zona = typeof ficha.ciudad_zona === 'string' ? ficha.ciudad_zona.trim() : '';
  if (!zona) faltantes.push('Falta guardar la ciudad o el código postal de la propiedad.');
  else if (!esZonaPublica(zona)) {
    faltantes.push('Usa una ciudad o código postal como zona pública, sin la dirección exacta.');
  }
  const precio = typeof ficha.precio === 'number' || typeof ficha.precio === 'string' ? Number(ficha.precio) : NaN;
  if (!Number.isFinite(precio) || precio <= 0) faltantes.push('Falta guardar un precio mayor que cero.');
  if (ficha.estado === 'vendida' || ficha.estado === 'en_contrato') {
    faltantes.push('Vuelve a marcar la ficha como disponible para generar textos.');
  }
  return faltantes;
}
