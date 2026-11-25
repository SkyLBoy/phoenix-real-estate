import { Zip, ZipPassThrough } from 'fflate';
import type { FotoDrivePanel } from './fotos-drive';

export async function crearZipFotos(
  fotos: FotoDrivePanel[],
  abrirOriginal: (foto: FotoDrivePanel) => Promise<Blob>,
  progreso: (numero: number) => void,
  vistaPrevia = false,
) {
  if (!fotos.length || fotos.length > 60) throw new Error('Selecciona entre 1 y 60 fotos para descargar un ZIP.');
  const partes: ArrayBuffer[] = [];
  const zip = new Zip((error, parte) => {
    if (error) throw error;
    partes.push(Uint8Array.from(parte).buffer);
  });
  let total = 0;
  for (const [indice, foto] of fotos.entries()) {
    progreso(indice + 1);
    let original;
    try {
      original = await abrirOriginal(foto);
    } catch (error) {
      const detalle = error instanceof Error ? error.message : 'Inténtalo de nuevo.';
      throw new Error(`No se pudo descargar ${foto.name}. ${detalle}`);
    }
    total += original.size;
    if (total > 80 * 1024 * 1024) throw new Error('Las fotos superan 80 MB. Elige menos imágenes para el ZIP.');
    // Un prefijo único evita colisiones entre nombres duplicados y rutas dentro del ZIP.
    let nombre = foto.name.replace(/[\\/<>:"|?*]/g, '_').trim() || 'Foto';
    if (vistaPrevia) {
      const extension = ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif' } as Record<string, string>)[original.type];
      if (!extension) throw new Error(`La vista de ${foto.name} no es una imagen compatible.`);
      nombre = `${nombre.replace(/\.[^.]+$/, '')} - vista previa.${extension}`;
    }
    const archivo = new ZipPassThrough(`${String(indice + 1).padStart(2, '0')} - ${nombre}`);
    zip.add(archivo);
    archivo.push(new Uint8Array(await original.arrayBuffer()), true);
  }
  zip.end();
  return new Blob(partes, { type: 'application/zip' });
}

export function nombreZipPropiedad(direccion?: string, vistaPrevia = false) {
  const nombre = (direccion ?? '').replace(/[\\/<>:"|?*]/g, '_')
    .split('').filter((caracter) => caracter.charCodeAt(0) >= 32 && caracter.charCodeAt(0) !== 127).join('')
    .trim().replace(/\.zip$/i, '').replace(/[. ]+$/, '').slice(0, 180);
  return nombre ? `${nombre}.zip` : vistaPrevia ? 'vistas-previas-facebook.zip' : 'fotos-originales.zip';
}
