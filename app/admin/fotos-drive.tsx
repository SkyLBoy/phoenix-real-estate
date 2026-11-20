'use client';

import { useEffect, useId, useState } from 'react';
import type { FotoDrivePanel as FotoDrive } from '@/lib/fotos-drive';

type AbrirFoto = (foto: FotoDrive, signal?: AbortSignal) => Promise<Blob>;

export function VistaFotoDrive({ foto, abrir, alCargar }: {
  foto: FotoDrive;
  abrir: AbrirFoto;
  alCargar?: () => void;
}) {
  const [imagen, setImagen] = useState<{ url: string; id: string } | null>(null);
  const [error, setError] = useState<{ id: string; mensaje: string } | null>(null);
  const [usarEnlaceDirecto, setUsarEnlaceDirecto] = useState(false);

  useEffect(() => {
    if (foto.miniaturaUrl) return;
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
  }, [foto, abrir]);

  if (error?.id === foto.id) {
    const enlace = new URL(`https://drive.google.com/file/d/${encodeURIComponent(foto.id)}/view`);
    if (foto.resourceKey) enlace.searchParams.set('resourcekey', foto.resourceKey);
    return (
      <div className="space-y-1">
        <p role="alert" className="text-red-300">{error.mensaje}</p>
        <a href={enlace.href} target="_blank" rel="noopener noreferrer" className="text-amber-300">Abrir archivo en Drive</a>
      </div>
    );
  }
  const miniatura = usarEnlaceDirecto ? foto.miniaturaUrl : foto.miniaturaDrive ?? foto.miniaturaUrl;
  const src = miniatura ?? (imagen?.id === foto.id ? imagen.url : null);
  if (!src) return <p role="status">Cargando foto…</p>;

  return (
    <figure className="space-y-2">
      {/* La vista previa usa una URL local creada desde la respuesta privada. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={foto.name} onLoad={alCargar}
        onError={() => {
          if (foto.miniaturaDrive && foto.miniaturaUrl && !usarEnlaceDirecto) setUsarEnlaceDirecto(true);
          else setError({ id: foto.id, mensaje: 'Drive no devolvió una imagen para esta vista. Abre el archivo en Drive para verificarlo.' });
        }} className="max-h-[65vh] w-full rounded-lg object-contain" />
      <figcaption className="break-all text-sm text-zinc-300">{foto.name}</figcaption>
    </figure>
  );
}

export function DescargarFotoDrive({ foto, abrir }: { foto: FotoDrive; abrir: AbrirFoto }) {
  const [descargando, setDescargando] = useState(false);
  const [error, setError] = useState('');

  const descargar = async () => {
    setDescargando(true);
    setError('');
    try {
      const blob = await abrir(foto);
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = foto.name.replace(/[\\/]/g, '_');
      document.body.append(enlace);
      enlace.click();
      enlace.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
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
}: {
  carpeta: string;
  seleccionadas: FotoDrive[];
  portada: string | null;
  alSeleccionar: (fotos: FotoDrive[]) => void;
  alElegirPortada: (foto: FotoDrive) => void;
  listar: (carpeta: string) => Promise<FotoDrive[]>;
  abrir: AbrirFoto;
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
      <p className="text-zinc-400">Revisa los nombres y las fotos. La portada y la carpeta pública deben ocultar la dirección exacta.</p>
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
            const miniatura = foto.miniaturaDrive ?? foto.miniaturaUrl;
            return (
              <li key={foto.id} className={`min-w-0 overflow-hidden rounded-xl border bg-zinc-950 ${elegida ? 'border-amber-500' : 'border-zinc-800'}`}>
                <button type="button" onClick={() => {
                  setVista(foto.id);
                  requestAnimationFrame(() => document.getElementById(idVista)?.scrollIntoView({ block: 'nearest' }));
                }} aria-label={`Ampliar ${foto.name}`}
                  className="relative grid aspect-[4/3] w-full place-items-center overflow-hidden bg-zinc-800">
                  <span className="px-2 text-zinc-300">Ver foto</span>
                  {miniatura && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={miniatura} src={miniatura} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover"
                      onError={(event) => { event.currentTarget.hidden = true; }} />
                  )}
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
