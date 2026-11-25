// Opciones estables para la cobertura del catálogo, independientes del inventario.
export const ciudadesPhoenix = [
  'Apache Junction', 'Avondale', 'Buckeye', 'Carefree', 'Casa Grande', 'Cave Creek',
  'Chandler', 'El Mirage', 'Florence', 'Fountain Hills', 'Gilbert', 'Glendale',
  'Goodyear', 'Guadalupe', 'Litchfield Park', 'Maricopa', 'Mesa', 'Paradise Valley',
  'Peoria', 'Phoenix', 'Queen Creek', 'Scottsdale', 'Surprise', 'Tempe', 'Tolleson',
  'Wickenburg', 'Youngtown',
] as const;

export function separarUbicacion(zona: string | null | undefined) {
  const original = zona?.trim() ?? '';
  const zip = original.match(/\b(\d{5})(?:-\d{4})?$/)?.[1] ?? '';
  const localidad = original.replace(/[,\s]*\b\d{5}(?:-\d{4})?$/, '')
    .replace(/(?:,\s*|\s+)(?:AZ|Arizona)$/i, '').trim();
  const ciudad = ciudadesPhoenix.find((opcion) => opcion.toLowerCase() === localidad.toLowerCase()) ?? '';
  return { ciudad, zip };
}

export function unirUbicacion(ciudad: string, zip: string) {
  return ciudad ? `${ciudad}, AZ${zip ? ` ${zip}` : ''}` : zip;
}
