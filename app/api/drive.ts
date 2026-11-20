import { parse } from 'node-html-parser';
import type { FotoDrive, FotoDrivePanel } from '@/lib/fotos-drive';

const identificador = /^[\w-]{1,200}$/;
const tiposImagen = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']);

export class ErrorDrive extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export function identificadorDrive(value: unknown): value is string {
  return typeof value === 'string' && identificador.test(value);
}

function carpetaDrive(enlace: string) {
  const url = URL.canParse(enlace) ? new URL(enlace) : null;
  const id = url?.pathname.match(/\/(?:drive\/(?:u\/\d+\/)?)?folders\/([\w-]+)\/?$/)?.[1]
    ?? (url && ['/open', '/embeddedfolderview'].includes(url.pathname) ? url.searchParams.get('id') : null);
  const key = url?.searchParams.get('resourcekey') ?? undefined;
  if (url?.origin !== 'https://drive.google.com' || !identificadorDrive(id)
    || (key !== undefined && !identificadorDrive(key))) {
    throw new ErrorDrive('Pega el enlace de una carpeta compartida de Google Drive', 400);
  }
  return { id, key };
}

async function pedirDrive(ruta: string, parametros: Record<string, string>, id: string, key?: string) {
  const apiKey = process.env.GOOGLE_DRIVE_API_KEY?.trim();
  if (!apiKey) throw new ErrorDrive('Falta configurar GOOGLE_DRIVE_API_KEY', 503);
  const url = new URL(`https://www.googleapis.com/drive/v3/files${ruta}`);
  url.search = new URLSearchParams({ ...parametros, key: apiKey }).toString();
  const headers = key ? { 'X-Goog-Drive-Resource-Keys': `${id}/${key}` } : undefined;
  const response = await fetch(url, { headers, cache: 'no-store', signal: AbortSignal.timeout(15000) })
    .catch(() => { throw new ErrorDrive('Google Drive no respondió. Intenta de nuevo.', 502); });
  if (!response.ok) {
    if (response.status === 403 || response.status === 404) {
      throw new ErrorDrive('Drive no dio acceso. Revisa que el enlace sea público y que la API esté habilitada.', 422);
    }
    throw new ErrorDrive('Google Drive no está disponible en este momento', 502);
  }
  return response;
}

function enlaceMiniatura(id: string, key?: string) {
  const url = new URL(`https://lh3.googleusercontent.com/d/${id}`);
  if (key) url.searchParams.set('resourcekey', key);
  return url;
}

function miniaturaDelListado(valor?: string) {
  if (!valor || !URL.canParse(valor)) return undefined;
  const url = new URL(valor);
  if (url.origin !== 'https://lh3.googleusercontent.com' || url.username || url.password
    || !url.pathname.startsWith('/drive-storage/')) return undefined;
  return url.href;
}

export function fotoParaPanel(foto: FotoDrive): FotoDrivePanel {
  if (process.env.GOOGLE_DRIVE_API_KEY?.trim()) return foto;
  const descarga = new URL('https://drive.google.com/uc');
  descarga.search = new URLSearchParams({ export: 'download', id: foto.id }).toString();
  if (foto.resourceKey) descarga.searchParams.set('resourcekey', foto.resourceKey);
  return { ...foto, miniaturaUrl: enlaceMiniatura(foto.id, foto.resourceKey).href, descargaUrl: descarga.href };
}

async function listarCarpetaPublica(id: string, key?: string): Promise<FotoDrive[]> {
  const url = new URL('https://drive.google.com/embeddedfolderview');
  url.searchParams.set('id', id);
  if (key) url.searchParams.set('resourcekey', key);

  const response = await fetch(url, {
    cache: 'no-store',
    redirect: 'manual',
    signal: AbortSignal.timeout(15000),
  }).catch(() => { throw new ErrorDrive('Google Drive no respondió. Intenta de nuevo.', 502); });
  if ([401, 403, 404].includes(response.status) || (response.status >= 300 && response.status < 400)) {
    throw new ErrorDrive('Drive no dio acceso. Comparte la carpeta como «Cualquier persona con el enlace».', 422);
  }
  if (!response.ok) throw new ErrorDrive('Google Drive no está disponible en este momento', 502);

  const documento = parse(await response.text());
  const lista = documento.querySelector('.flip-entries');
  const entradas = lista?.querySelectorAll('.flip-entry') ?? documento.querySelectorAll('.flip-entry');
  if (!lista && !entradas.length) {
    throw new ErrorDrive('No se pudo leer la vista pública de Drive. Abre el enlace sin iniciar sesión para comprobar el acceso.', 422);
  }

  const fotos = new Map<string, FotoDrive>();
  for (const entrada of entradas) {
    const href = entrada.querySelector('a[href]')?.getAttribute('href');
    if (!href || !URL.canParse(href, url)) continue;
    const archivo = new URL(href, url);
    const fileId = archivo.pathname.match(/^\/file\/d\/([\w-]+)(?:\/|$)/)?.[1];
    const name = entrada.querySelector('.flip-entry-title')?.text.trim();
    if (archivo.origin !== 'https://drive.google.com' || !identificadorDrive(fileId) || !name) continue;

    const icono = entrada.querySelector('.flip-entry-list-icon img')?.getAttribute('src');
    const tipo = icono?.match(/\/type\/([^?#]+)$/)?.[1];
    if (tipo ? !tiposImagen.has(tipo) : !/\.(?:jpe?g|png|webp|gif|avif)$/i.test(name)) continue;
    const resourceKey = archivo.searchParams.get('resourcekey');
    const miniaturaDrive = miniaturaDelListado(entrada.querySelector('.flip-entry-thumb img')?.getAttribute('src'));
    fotos.set(fileId, {
      id: fileId,
      name,
      ...(miniaturaDrive ? { miniaturaDrive } : {}),
      ...(identificadorDrive(resourceKey) ? { resourceKey } : {}),
    });
  }
  return [...fotos.values()];
}

export async function listarFotosDrive(enlace: string): Promise<FotoDrive[]> {
  const { id, key } = carpetaDrive(enlace);
  if (!process.env.GOOGLE_DRIVE_API_KEY?.trim()) return listarCarpetaPublica(id, key);

  const meta = await pedirDrive(`/${id}`, { fields: 'mimeType,trashed', supportsAllDrives: 'true' }, id, key);
  const carpeta = await meta.json();
  if (carpeta.mimeType !== 'application/vnd.google-apps.folder' || carpeta.trashed) {
    throw new ErrorDrive('El enlace debe abrir una carpeta de Google Drive', 400);
  }

  const fotos: FotoDrive[] = [];
  let pageToken = '';
  do {
    const response = await pedirDrive('', {
      q: `'${id}' in parents and trashed = false and mimeType contains 'image/'`,
      fields: 'nextPageToken,files(id,name,mimeType,resourceKey,capabilities(canDownload))',
      pageSize: '100',
      supportsAllDrives: 'true',
      includeItemsFromAllDrives: 'true',
      orderBy: 'name_natural',
      ...(pageToken ? { pageToken } : {}),
    }, id, key);
    const pagina = await response.json();
    for (const foto of pagina.files ?? []) {
      if (identificadorDrive(foto.id) && typeof foto.name === 'string'
        && tiposImagen.has(foto.mimeType) && foto.capabilities?.canDownload !== false) {
        fotos.push({
          id: foto.id,
          name: foto.name,
          ...(identificadorDrive(foto.resourceKey) ? { resourceKey: foto.resourceKey } : {}),
        });
      }
    }
    pageToken = pagina.nextPageToken ?? '';
  } while (pageToken);
  return fotos;
}

function portadaDriveEnAltaResolucion(miniatura?: string) {
  const enlace = miniaturaDelListado(miniatura);
  if (!enlace) return undefined;
  const url = new URL(enlace);
  url.pathname = url.pathname.replace(/=s\d+$/, '=s1600');
  return url.href;
}

export async function abrirFotoDrive(id: string, key?: string, miniaturaDrive?: string) {
  if (!identificadorDrive(id) || (key !== undefined && !identificadorDrive(key))) {
    throw new ErrorDrive('Identificador de foto inválido', 400);
  }
  if (!process.env.GOOGLE_DRIVE_API_KEY?.trim()) {
    return new Response(null, { status: 302, headers: {
      Location: portadaDriveEnAltaResolucion(miniaturaDrive) ?? enlaceMiniatura(id, key).href,
      'Cache-Control': 'no-store',
    } });
  }
  const response = await pedirDrive(`/${id}`, { alt: 'media', supportsAllDrives: 'true' }, id, key);
  const tipo = response.headers.get('content-type')?.split(';')[0] ?? '';
  if (!tiposImagen.has(tipo) || !response.body) {
    await response.body?.cancel();
    throw new ErrorDrive('El archivo no es una imagen compatible', 422);
  }
  return new Response(response.body, { headers: {
    'Content-Type': tipo,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store',
  } });
}
