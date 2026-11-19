'use client';

import { useEffect, useState } from 'react';
import type { FotoDrivePanel as FotoDrive } from '@/lib/fotos-drive';

type AbrirFoto = (foto: FotoDrive, signal?: AbortSignal) => Promise<Blob>;

export function VistaFotoDrive({ foto, abrir, alCargar }: {
  foto: FotoDrive;
  abrir: AbrirFoto;
  alCargar?: () => void;
}) {
  const [imagen, setImagen] = useState<{ url: string; id: string } | null>(null);
  const [error, setError] = useState<{ id: string; mensaje: string } | null>(null);

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

  if (error?.id === foto.id) return <p role="alert" className="text-red-300">{error.mensaje}</p>;
  const src = foto.miniaturaUrl ?? (imagen?.id === foto.id ? imagen.url : null);
  if (!src) return <p role="status">Cargando foto…</p>;

  return (
    <figure className="space-y-2">
      {/* La vista previa usa una URL local creada desde la respuesta privada. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={foto.name} onLoad={alCargar}
        onError={() => setError({ id: foto.id, mensaje: 'Drive no pudo mostrar esta foto. Revisa que el archivo sea público.' })} className="max-h-80 w-full rounded-lg object-contain" />
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
      {visibles.length > 0 && (
        <ul className="max-h-72 divide-y divide-zinc-800 overflow-auto">
          {visibles.map((foto) => {
            const elegida = seleccionadas.some(({ id }) => id === foto.id);
            return (
              <li key={foto.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2">
                <label className="flex min-w-0 items-center gap-2">
                  <input type="checkbox" checked={elegida} onChange={(event) => alSeleccionar(event.target.checked
                    ? [...seleccionadas, foto]
                    : seleccionadas.filter(({ id }) => id !== foto.id))} />
                  <span className="break-all">{foto.name}</span>
                </label>
                <button type="button" onClick={() => setVista(vista === foto.id ? null : foto.id)}
                  aria-label={`Revisar ${foto.name}`} className="text-amber-300">
                  {vista === foto.id ? 'Cerrar vista' : 'Ver foto'}
                </button>
                <button type="button" onClick={() => alElegirPortada(foto)} disabled={portada === foto.id}
                  aria-label={`Usar ${foto.name} como portada`} className="text-amber-300 disabled:text-zinc-400">
                  {portada === foto.id ? 'Portada elegida' : 'Usar de portada'}
                </button>
                {elegida && <DescargarFotoDrive foto={foto} abrir={abrir} />}
              </li>
            );
          })}
        </ul>
      )}
      {fotoVista && <VistaFotoDrive key={fotoVista.id} foto={fotoVista} abrir={abrir} />}
    </section>
  );
}
