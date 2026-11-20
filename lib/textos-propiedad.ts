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
  incluirArv: 'Incluir ARV confirmado',
} as const;

export type CondicionesTexto = Partial<Record<keyof typeof condicionesTexto, boolean>> & {
  enganche?: number;
};
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
  else if (zona.length > 100 || !/^(?:\d{5}(?:-\d{4})?|\p{L}[\p{L}\p{M} .,’-]*(?: \d{5}(?:-\d{4})?)?)$/u.test(zona)) {
    faltantes.push('Usa una ciudad o código postal como zona pública, sin la dirección exacta.');
  }
  const precio = typeof ficha.precio === 'number' || typeof ficha.precio === 'string' ? Number(ficha.precio) : NaN;
  if (!Number.isFinite(precio) || precio <= 0) faltantes.push('Falta guardar un precio mayor que cero.');
  if (ficha.estado === 'vendida' || ficha.estado === 'en_contrato') {
    faltantes.push('Vuelve a marcar la ficha como disponible para generar textos.');
  }
  return faltantes;
}
