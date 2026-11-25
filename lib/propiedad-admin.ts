import type { FotoDrivePanel as FotoDrive } from './fotos-drive';
import type { EstadoDisponibilidad } from './disponibilidad';
import type { TextosFicha } from './textos-propiedad';

export interface Propiedad extends TextosFicha {
  ficha_version: number;
  id: string;
  direccion_privada: string | null;
  ciudad_zona: string | null;
  precio: number | null;
  arv: number | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  drive_url: string | null;
  imagen_portada: string | null;
  fotos_drive: FotoDrive[];
  portada_drive_id: string | null;
  lot_size: string | null;
  year_built: number | null;
  notas_extra: string | null;
  publicada_en: string | null;
  estado: EstadoDisponibilidad;
  ultima_confirmacion: string | null;
}

