import type { EstadoDisponibilidad } from './disponibilidad';
import { numeroWhatsAppAsesor } from './whatsapp-asesor.mjs';

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
  estado: EstadoDisponibilidad;
  ultima_confirmacion: string | null;
}

export const CAMPOS_PUBLICOS =
  'id, ciudad_zona, precio, arv, beds, baths, sqft, lot_size, year_built, drive_url, imagen_portada, estado, tiene_portada_drive, ultima_confirmacion';

export function enlaceWhatsApp(prop: PropiedadPublica) {
  const numero = numeroWhatsAppAsesor();
  if (!numero) return null;
  const precio = Number(prop.precio).toLocaleString('en-US');
  const mensaje = prop.estado === 'disponible'
    ? `Hola, me interesa coordinar una visita para la propiedad en ${prop.ciudad_zona} de $${precio} USD (ref. ${prop.id}).`
    : `Hola, Sergio. Vi la ficha de ${prop.ciudad_zona} de $${precio} USD (ref. ${prop.id}). ¿Tienes alguna casa similar disponible?`;
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
}

export function enlacePortada(prop: PropiedadPublica) {
  return prop.tiene_portada_drive
    ? `/api/propiedades/${encodeURIComponent(prop.id)}/portada`
    : prop.imagen_portada;
}
