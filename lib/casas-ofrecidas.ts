export const condicionesCasa = {
  habitable: 'Habitable',
  necesita_arreglos: 'Necesita arreglos',
  por_confirmar: 'No estoy seguro',
} as const;

export const estadosOferta = {
  nueva: 'Nueva',
  contactada: 'Contactada',
  en_evaluacion: 'En evaluación',
  cerrada: 'Cerrada',
} as const;

export interface CasaOfrecida {
  id: string;
  nombre: string;
  whatsapp: string;
  zona: string;
  condicion: keyof typeof condicionesCasa;
  precio_esperado: number | null;
  plazo: string | null;
  fotos_url: string | null;
  notas: string | null;
  estado: keyof typeof estadosOferta;
}
