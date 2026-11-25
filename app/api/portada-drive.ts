import sharp from 'sharp';
import { ErrorDrive } from './drive';

export async function optimizarFotoPublica(bytes: Buffer) {
  try {
    const imagen = await sharp(bytes, { limitInputPixels: 64000000 }).rotate()
      .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
    if (imagen.length > 2097152) throw new Error('Imagen demasiado grande');
    return imagen;
  } catch {
    throw new ErrorDrive('No se pudo preparar la foto. Elige otra imagen.', 422);
  }
}
