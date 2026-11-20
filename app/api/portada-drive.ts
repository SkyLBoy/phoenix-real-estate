import sharp from 'sharp';
import type { FotoDrive } from '@/lib/fotos-drive';
import { ErrorDrive } from './drive';
import { descargarImagenPortada } from './foto-original-drive';

export async function crearCopiaPortada(fotos: FotoDrive[] | null, id: string) {
  const foto = fotos?.find((seleccionada) => seleccionada.id === id);
  if (!foto) throw new ErrorDrive('La portada elegida cambió. Revisa de nuevo la ficha.', 409);
  const { bytes } = await descargarImagenPortada(foto);
  try {
    const optimizada = await sharp(bytes, { limitInputPixels: 64_000_000 })
      .rotate()
      .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
    if (optimizada.length > 2 * 1024 * 1024) throw new Error('Tamaño de portada');
    return '\\x' + optimizada.toString('hex');
  } catch {
    throw new ErrorDrive('No se pudo preparar esta portada. Elige otra foto o una URL de portada alternativa.', 422);
  }
}
