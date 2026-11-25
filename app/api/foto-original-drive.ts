import { parse } from 'node-html-parser';
import type { FotoDrive } from '@/lib/fotos-drive';
import { abrirFotoDrive, ErrorDrive, identificadorDrive } from './drive';

const maximoBytes = 24 * 1024 * 1024;

function tipoImagen(bytes: Buffer) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (['GIF87a', 'GIF89a'].includes(bytes.toString('ascii', 0, 6))) return 'image/gif';
  if (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  if (bytes.toString('ascii', 4, 8) === 'ftyp' && /avif|avis/.test(bytes.toString('ascii', 8, 32))) return 'image/avif';
  return null;
}

async function leerImagen(respuesta: Response) {
  if (!respuesta.ok || !respuesta.body || respuesta.headers.get('content-type')?.includes('text/html')) {
    await respuesta.body?.cancel();
    throw new ErrorDrive('Drive no entregó la imagen. Comprueba los permisos de lectura y descarga.', 422);
  }
  if (Number(respuesta.headers.get('content-length')) > maximoBytes) {
    await respuesta.body.cancel();
    throw new ErrorDrive('La foto supera el límite de 24 MB para esta descarga.', 413);
  }

  const lector = respuesta.body.getReader();
  const partes: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { value, done } = await lector.read();
      if (done) break;
      total += value.length;
      if (total > maximoBytes) {
        await lector.cancel();
        throw new ErrorDrive('La foto supera el límite de 24 MB para esta descarga.', 413);
      }
      partes.push(value);
    }
  } finally {
    lector.releaseLock();
  }
  const bytes = Buffer.concat(partes, total);
  const tipo = tipoImagen(bytes);
  if (!tipo) throw new ErrorDrive('Drive no devolvió una foto JPEG, PNG, WebP, GIF o AVIF.', 422);
  return { bytes, tipo };
}

// Sólo interpreta el formulario público de confirmación de Google, nunca páginas de inicio de sesión.
async function confirmacionPublica(respuesta: Response, actual: URL, original: URL) {
  const lector = respuesta.body?.getReader();
  if (!lector) return null;
  const partes: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await lector.read();
      if (done) break;
      total += value.byteLength;
      if (total > 256 * 1024) { await lector.cancel(); return null; }
      partes.push(value);
    }
  } finally { lector.releaseLock(); }
  const documento = parse(Buffer.concat(partes).toString('utf8'));
  if (/owner hasn't given you permission to download|only the owner and editors can download/i.test(documento.textContent)) {
    throw new ErrorDrive('El propietario de Drive desactivó las descargas para lectores. Pídele que habilite la descarga de estos archivos para lectores con el enlace. Ver las fotos no garantiza permiso para descargarlas.', 403);
  }
  const formulario = documento.querySelector('form#download-form');
  const accion = formulario?.getAttribute('action');
  if (!formulario || !accion || !URL.canParse(accion, actual)
    || (formulario.getAttribute('method') ?? 'get').toLowerCase() !== 'get') return null;
  const destino = new URL(accion, actual);
  if (destino.protocol !== 'https:' || destino.username || destino.password || destino.port
    || !((destino.hostname === 'drive.usercontent.google.com' && destino.pathname === '/download')
      || (destino.hostname === 'drive.google.com' && destino.pathname === '/uc'))) return null;
  for (const input of formulario.querySelectorAll('input[type="hidden"]')) {
    const nombre = input.getAttribute('name');
    if (nombre && ['id', 'export', 'confirm', 'uuid', 'resourcekey'].includes(nombre)) destino.searchParams.set(nombre, input.getAttribute('value') ?? '');
  }
  if (destino.searchParams.get('id') !== original.searchParams.get('id') || !destino.searchParams.get('confirm')) return null;
  const clave = original.searchParams.get('resourcekey');
  if (clave) destino.searchParams.set('resourcekey', clave);
  return destino;
}

// Google redirige las descargas hacia sus hosts de contenido. No se reenvían credenciales.
async function imagenPublica(enlace: URL, signal: AbortSignal) {
  let destino = enlace;
  for (let salto = 0; salto < 5; salto++) {
    const google = destino.hostname === 'drive.google.com' || destino.hostname === 'drive.usercontent.google.com'
      || destino.hostname.endsWith('.googleusercontent.com');
    if (destino.protocol !== 'https:' || destino.username || destino.password || destino.port || !google) break;
    const respuesta = await fetch(destino, { redirect: 'manual', cache: 'no-store', signal })
      .catch(() => { throw new ErrorDrive('Drive no respondió. Vuelve a intentar la descarga.', 502); });
    if (respuesta.ok && respuesta.headers.get('content-type')?.includes('text/html')) {
      const confirmacion = await confirmacionPublica(respuesta, destino, enlace);
      if (!confirmacion) break;
      destino = confirmacion;
      continue;
    }
    if (respuesta.status < 300 || respuesta.status >= 400) return leerImagen(respuesta);
    const location = respuesta.headers.get('location');
    await respuesta.body?.cancel();
    if (!location || !URL.canParse(location, destino)) break;
    destino = new URL(location, destino);
  }
  throw new ErrorDrive('Drive solicita acceso. Abre el enlace en una ventana sin sesión para revisar los permisos.', 422);
}

export async function descargarOriginalDrive(id: string, key?: string) {
  if (!identificadorDrive(id) || (key !== undefined && !identificadorDrive(key))) {
    throw new ErrorDrive('Identificador de foto inválido', 400);
  }
  if (process.env.GOOGLE_DRIVE_API_KEY?.trim()) return leerImagen(await abrirFotoDrive(id, key));
  const descarga = new URL('https://drive.google.com/uc');
  descarga.search = new URLSearchParams({ export: 'download', id }).toString();
  if (key) descarga.searchParams.set('resourcekey', key);
  const signal = AbortSignal.timeout(20000);
  try {
    return await imagenPublica(descarga, signal);
  } catch (error) {
    if (!(error instanceof ErrorDrive) || error.status !== 422) throw error;
    // Algunas carpetas pasan por la confirmación intermedia de descarga de Google.
    const directa = new URL('https://drive.usercontent.google.com/download');
    directa.search = descarga.search;
    directa.searchParams.set('confirm', 't');
    return imagenPublica(directa, signal);
  }
}

export async function descargarImagenPortada(foto: FotoDrive) {
  try {
    return await descargarOriginalDrive(foto.id, foto.resourceKey);
  } catch (error) {
    if (process.env.GOOGLE_DRIVE_API_KEY?.trim() || !identificadorDrive(foto.id)) throw error;
    const miniatura = new URL('https://drive.google.com/thumbnail');
    miniatura.search = new URLSearchParams({ id: foto.id, sz: 'w1600' }).toString();
    if (foto.resourceKey) miniatura.searchParams.set('resourcekey', foto.resourceKey);
    return imagenPublica(miniatura, AbortSignal.timeout(10000));
  }
}
