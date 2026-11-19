export interface PropiedadPublica {
  id: string;
  ciudad_zona: string;
  precio: number;
  arv: number | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  lot_size: string | null;
  year_built: number | null;
  drive_url: string | null;
  imagen_portada: string | null;
  tiene_portada_drive: boolean;
  estado: 'disponible' | 'en_contrato' | 'vendida';
}

export const CAMPOS_PUBLICOS =
  'id, ciudad_zona, precio, arv, beds, baths, sqft, lot_size, year_built, drive_url, imagen_portada, estado, tiene_portada_drive';

export function enlaceWhatsApp(prop: PropiedadPublica) {
  const numero = process.env.NEXT_PUBLIC_WHATSAPP_ASESOR || '16025550199';
  const mensaje = `Hola, me interesa coordinar una visita para la propiedad en ${prop.ciudad_zona} de $${Number(prop.precio).toLocaleString()} USD (ref. ${prop.id}).`;
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
}

export function enlacePortada(prop: PropiedadPublica) {
  return prop.tiene_portada_drive
    ? `/api/propiedades/${encodeURIComponent(prop.id)}/portada`
    : prop.imagen_portada;
}
