'use client';

import { useEffect, useId, useState } from 'react';
import type { FotoDrivePanel as FotoDrive } from '@/lib/fotos-drive';

export type DescargarFotosDrive = (foto: FotoDrive, modo?: 'original' | 'vista') => Promise<Blob>;

type AbrirFoto = (foto: FotoDrive, signal?: AbortSignal) => Promise<Blob>;

function guardarDescarga(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  document.body.append(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export function DescargarSeleccionDrive({ fotos, abrirOriginal, nombrePropiedad }: { fotos: FotoDrive[]; abrirOriginal: DescargarFotosDrive; nombrePropiedad?: string }) {
  const [progreso, setProgreso] = useState(0);
  const [error, setError] = useState('');

  const descargar = async (modo: 'original' | 'vista') => {
    setError('');
    setProgreso(1);
    try {
      const { crearZipFotos, nombreZipPropiedad } = await import('../../lib/zip-fotos');
      const zip = await crearZipFotos(fotos, (foto) => abrirOriginal(foto, modo), setProgreso, modo === 'vista');
      guardarDescarga(zip, nombreZipPropiedad(nombrePropiedad, modo === 'vista'));
    } catch (causa) {
      setError(causa instanceof Error ? causa.message : 'No se pudo preparar el ZIP. Inténtalo de nuevo.');
    } finally {
      setProgreso(0);
    }
  };

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={progreso > 0} onClick={() => descargar('vista')}
          className="public-action public-action-primary min-h-11">
          Descargar vistas previas para Facebook ({fotos.length}) en ZIP
        </button>
        <button type="button" disabled={progreso > 0} onClick={() => descargar('original')}
          className="public-action min-h-11">Descargar originales ({fotos.length}) en ZIP</button>
      </div>
      <p className="text-sm text-zinc-400">Las vistas previas son copias de lo que Drive permite visualizar. Pueden tener baja resolución; no son los originales. Su tamaño no se aumenta.</p>
      {progreso > 0 && <p role="status">Preparando ZIP · {progreso}/{fotos.length}</p>}
      {error && <p role="alert" className="text-red-300">{error}</p>}
    </div>
  );
}

export function VistaFotoDrive({ foto, abrir, alCargar, miniatura = false }: {
  foto: FotoDrive;
  abrir: AbrirFoto;
  alCargar?: () => void;
  miniatura?: boolean;
}) {
  const [imagen, setImagen] = useState<{ url: string; id: string } | null>(null);
  const [error, setError] = useState<{ id: string; mensaje: string } | null>(null);
  const [usarEnlaceDirecto, setUsarEnlaceDirecto] = useState(false);
  const [usarProxy, setUsarProxy] = useState(false);

  useEffect(() => {
    if (!usarProxy && (foto.miniaturaDrive || foto.miniaturaUrl)) return;
    const controller = new AbortController();
    let url: string | undefined;
    abrir(foto, controller.signal).then((blob) => {
      if (controller.signal.aborted) return;
      url = URL.createObjectURL(blob);
      setImagen({ id: foto.id, url });
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) {
        setError({ id: foto.id, mensaje: cause instanceof Error ? cause.message : 'No se pudo abrir la foto' });
      }
    });
    return () => {
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [foto, abrir, usarProxy]);

  if (error?.id === foto.id) {
    if (miniatura) return <span role="alert" className="p-3 text-center">Foto no disponible. Pulsa para revisar.</span>;
    const enlace = new URL(`https://drive.google.com/file/d/${encodeURIComponent(foto.id)}/view`);
    if (foto.resourceKey) enlace.searchParams.set('resourcekey', foto.resourceKey);
    return (
      <div className="space-y-1">
        <p role="alert" className="text-red-300">{error.mensaje}</p>
        <a href={enlace.href} target="_blank" rel="noopener noreferrer" className="text-amber-300">Abrir archivo en Drive</a>
      </div>
    );
  }
  const enlace = usarEnlaceDirecto ? foto.miniaturaUrl : foto.miniaturaDrive ?? foto.miniaturaUrl;
  const src = !usarProxy && enlace ? enlace : imagen?.id === foto.id ? imagen.url : null;
  if (!src) return <span role="status">Cargando foto…</span>;

  const imagenVisible = (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={miniatura ? '' : foto.name} onLoad={alCargar} loading={miniatura ? 'lazy' : undefined}
      referrerPolicy="no-referrer"
      onError={() => {
        if (!usarProxy && foto.miniaturaDrive && foto.miniaturaUrl && !usarEnlaceDirecto) setUsarEnlaceDirecto(true);
        else if (!usarProxy) setUsarProxy(true);
        else setError({ id: foto.id, mensaje: 'No se pudo mostrar la imagen. Abre el archivo en Drive para verificarlo.' });
      }} className={miniatura ? 'absolute inset-0 h-full w-full object-cover' : 'max-h-[65vh] w-full rounded-lg object-contain'} />
  );
  if (miniatura) return imagenVisible;
  return <figure className="space-y-2">
    {imagenVisible}
    <figcaption className="break-all text-sm text-zinc-300">{foto.name}</figcaption>
  </figure>;
}

export function DescargarFotoDrive({ foto, abrir }: { foto: FotoDrive; abrir: AbrirFoto }) {
  const [descargando, setDescargando] = useState(false);
  const [error, setError] = useState('');

  const descargar = async () => {
    setDescargando(true);
    setError('');
    try {
      const blob = await abrir(foto);
      guardarDescarga(blob, foto.name.replace(/[\\/]/g, '_'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo descargar la foto');
    } finally {
      setDescargando(false);
    }
  };

  if (foto.descargaUrl) {
    return (
      <a href={foto.descargaUrl} target="_blank" rel="noopener noreferrer"
        aria-label={`Descargar ${foto.name}`} className="text-amber-300">
        Descargar
      </a>
    );
  }

  return (
    <span>
      <button type="button" onClick={descargar} disabled={descargando}
        aria-label={`Descargar ${foto.name}`}
        className="text-amber-300 disabled:text-zinc-500">
        {descargando ? 'Descargando…' : 'Descargar'}
      </button>
      {error && <span role="alert" className="block text-red-300">{error}</span>}
    </span>
  );
}

export function SelectorFotosDrive({
  carpeta,
  seleccionadas,
  portada,
  alSeleccionar,
  alElegirPortada,
  listar,
  abrir,
  abrirOriginal,
  nombrePropiedad,
}: {
  carpeta: string;
  seleccionadas: FotoDrive[];
  portada: string | null;
  alSeleccionar: (fotos: FotoDrive[]) => void;
  alElegirPortada: (foto: FotoDrive) => void;
  listar: (carpeta: string) => Promise<FotoDrive[]>;
  abrir: AbrirFoto;
  abrirOriginal: DescargarFotosDrive;
  nombrePropiedad?: string;
}) {
  const idVista = useId();
  const [fotos, setFotos] = useState<FotoDrive[] | null>(null);
  const [vista, setVista] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  const cargar = async () => {
    setCargando(true);
    setError('');
    try {
      setFotos(await listar(carpeta));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo abrir la carpeta');
    } finally {
      setCargando(false);
    }
  };

  const visibles = fotos ?? seleccionadas;
  const fotoVista = visibles.find((foto) => foto.id === vista);

  return (
    <section className="space-y-3 rounded-lg border border-zinc-800 p-3 text-sm" aria-label="Fotos de Google Drive">
      <button type="button" onClick={cargar} disabled={cargando}
        className="rounded-lg bg-zinc-800 px-3 py-2 font-medium disabled:opacity-50">
        {cargando ? 'Cargando fotos…' : 'Ver fotos de la carpeta'}
      </button>
      <p className="text-zinc-400">Revisa las fotos y elige cuáles usar. Antes de publicar, revisa que las copias públicas oculten la dirección exacta.</p>
      {seleccionadas.length > 0 && <DescargarSeleccionDrive fotos={seleccionadas} abrirOriginal={abrirOriginal} nombrePropiedad={nombrePropiedad} />}
      {error && <p role="alert" className="text-red-300">{error}</p>}
      {fotos?.length === 0 && <p>No hay fotos compatibles para descargar en esta carpeta.</p>}
      {fotos && seleccionadas.some((foto) => !fotos.some((disponible) => disponible.id === foto.id)) && (
        <div className="space-y-1 text-amber-300">
          <p>Hay fotos elegidas que ya no están en la carpeta.</p>
          <button type="button" className="underline"
            onClick={() => alSeleccionar(seleccionadas.filter((foto) => fotos.some(({ id }) => id === foto.id)))}>
            Quitar fotos no disponibles
          </button>
        </div>
      )}
      {fotoVista && (
        <div id={idVista} className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950 p-3">
          <div className="flex justify-end">
            <button type="button" onClick={() => setVista(null)} className="text-amber-300">Cerrar vista</button>
          </div>
          <VistaFotoDrive key={fotoVista.id} foto={fotoVista} abrir={abrir} />
        </div>
      )}
      {visibles.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {visibles.map((foto) => {
            const elegida = seleccionadas.some(({ id }) => id === foto.id);
            return (
              <li key={foto.id} className={`min-w-0 overflow-hidden rounded-xl border bg-zinc-950 ${elegida ? 'border-amber-500' : 'border-zinc-800'}`}>
                <button type="button" onClick={() => {
                  setVista(foto.id);
                  requestAnimationFrame(() => document.getElementById(idVista)?.scrollIntoView({ block: 'nearest' }));
                }} aria-label={`Ampliar ${foto.name}`}
                  className="relative grid aspect-[4/3] w-full place-items-center overflow-hidden bg-zinc-800">
                  <VistaFotoDrive key={foto.id} foto={foto} abrir={abrir} miniatura />
                </button>
                <div className="space-y-2 p-3">
                  <label className="flex min-w-0 items-center gap-2">
                    <input type="checkbox" checked={elegida} onChange={(event) => alSeleccionar(event.target.checked
                      ? [...seleccionadas, foto]
                      : seleccionadas.filter(({ id }) => id !== foto.id))} />
                    <span className="break-all">{foto.name}</span>
                  </label>
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    <button type="button" onClick={() => alElegirPortada(foto)} disabled={portada === foto.id}
                      aria-label={`Usar ${foto.name} como portada`} className="text-amber-300 disabled:text-zinc-400">
                      {portada === foto.id ? 'Portada elegida' : 'Usar de portada'}
                    </button>
                    {elegida && <DescargarFotoDrive foto={foto} abrir={abrir} />}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
