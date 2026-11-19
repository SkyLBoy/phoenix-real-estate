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
