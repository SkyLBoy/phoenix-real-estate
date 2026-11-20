import type { FotoDrive } from '@/lib/fotos-drive';
import { identificadorDrive, listarFotosDrive } from '../../drive';

// La copia WebP solo se lee al servir una portada individual.
export const camposInventario = 'id,created_at,ciudad_zona,direccion_privada,precio,arv,beds,baths,sqft,lot_size,year_built,drive_url,imagen_portada,fotos_drive,portada_drive_id,tiene_portada_drive,notas_extra,publicada_en,estado,ultima_confirmacion,condiciones_texto,textos_version,script_fb_es,script_fb_en,script_wa_vip,script_filtro_curiosos,script_fb_es_aprobado,script_fb_en_aprobado,script_wa_vip_aprobado,script_filtro_curiosos_aprobado';

function texto(value: unknown) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string') throw new Error('Hay campos de texto inválidos');
  return value.trim() || null;
}

function numero(value: unknown) {
  if (value == null || (typeof value === 'string' && !value.trim())) return null;
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new Error('Hay campos numéricos inválidos');
  }
  const result = Number(value);
  if (!Number.isFinite(result) || result < 0) throw new Error('Hay campos numéricos inválidos');
  return result;
}

export function urlPublica(value: unknown) {
  const result = texto(value);
  if (!result) return null;
  try {
    const url = new URL(result);
    if (!/^https?:\/\/[^\s]+$/i.test(result) || url.username || url.password) {
      throw new Error();
    }
  } catch {
    throw new Error('Usa un enlace HTTP o HTTPS válido');
  }
  return result;
}

export async function camposFicha(body: Record<string, unknown>) {
  const driveUrl = urlPublica(body.drive_url);
  const seleccion = body.fotos_drive_ids ?? [];
  const portada = body.portada_drive_id ?? null;
  if (!Array.isArray(seleccion) || !seleccion.every(identificadorDrive)
    || (portada !== null && (!identificadorDrive(portada) || !seleccion.includes(portada)))) {
    throw new Error('Revisa la selección de fotos y portada de Drive');
  }
  let fotos: FotoDrive[] = [];
  if (seleccion.length) {
    if (!driveUrl) throw new Error('Agrega el enlace de la carpeta para guardar las fotos');
    const disponibles = await listarFotosDrive(driveUrl);
    const ids = new Set(seleccion);
    fotos = disponibles.filter((foto) => ids.has(foto.id));
    if (fotos.length !== ids.size) throw new Error('Algunas fotos ya no están disponibles en esa carpeta');
  }
  return {
    direccion_privada: texto(body.direccion_privada),
    ciudad_zona: texto(body.ciudad_zona),
    precio: numero(body.precio),
    arv: numero(body.arv),
    beds: numero(body.beds),
    baths: numero(body.baths),
    sqft: numero(body.sqft),
    lot_size: texto(body.lot_size),
    year_built: numero(body.year_built),
    drive_url: driveUrl,
    fotos_drive: fotos,
    portada_drive_id: portada,
    imagen_portada: urlPublica(body.imagen_portada),
    notas_extra: texto(body.notas_extra),
  };
}
