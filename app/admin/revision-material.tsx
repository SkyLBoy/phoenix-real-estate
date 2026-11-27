'use client';

import { useEffect, useState } from 'react';
import { respuestaPrivada } from '@/lib/api-admin';
import type { FotoDrive } from '@/lib/fotos-drive';

type Copia = { id: string; fuente: string };
export type MaterialRevisado = { portada_publica_id: string; galeria_publica_ids: string[]; material_revisado: true; confirmar_disponibilidad: boolean };

function VistaCopia({ copia, userId, alCargar }: { copia: Copia; userId: string; alCargar: (id: string) => void }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    let local: string | undefined;
    respuestaPrivada(userId, `/api/admin/material-publico?archivo=${encodeURIComponent(copia.id)}`, { signal: controller.signal })
      .then((respuesta) => respuesta.blob()).then((blob) => {
        if (!controller.signal.aborted) { local = URL.createObjectURL(blob); setUrl(local); }
      }).catch(() => { if (!controller.signal.aborted) setError('No se pudo abrir esta copia. Prepara las fotos nuevamente.'); });
    return () => { controller.abort(); if (local) URL.revokeObjectURL(local); };
  }, [copia.id, userId]);
  if (error) return <p role="alert">{error}</p>;
  if (!url) return <p role="status">Abriendo copia…</p>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="Foto preparada para el catálogo" width={800} height={600} onLoad={() => alCargar(copia.id)}
    onError={() => setError('No se pudo mostrar esta copia. Prepara las fotos nuevamente.')}
    className="aspect-[4/3] w-full rounded-lg object-contain" />;
}

export function RevisionMaterial({ ficha, userId, publicar, ocupado }: {
  ficha: { id: string; ficha_version: number; fotos_drive: FotoDrive[]; portada_drive_id: string | null;
    imagen_portada: string | null; publicada_en: string | null; ciudad_zona: string | null; estado: string };
  userId: string;
  publicar: (material: MaterialRevisado) => Promise<void>;
  ocupado: boolean;
}) {
  const portada = ficha.portada_drive_id ?? 'portada-alternativa';
  const [seleccion, setSeleccion] = useState<string[]>([portada]);
  const [copias, setCopias] = useState<Copia[]>([]);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [preparando, setPreparando] = useState(false);
  const [error, setError] = useState('');
  const [cargadas, setCargadas] = useState<string[]>([]);
  const [revisadas, setRevisadas] = useState(false);
  const [confirmada, setConfirmada] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const listas = copias.length === seleccion.length && copias.every((copia) => seleccion.includes(copia.fuente) && cargadas.includes(copia.id));

  const preparar = async () => {
    setPreparando(true); setError(''); setRevisadas(false); setCopias([]); setCargadas([]);
    try {
      if (portada === 'portada-alternativa' && !archivo) throw new Error('Sube la imagen de la portada alternativa para guardar una copia.');
      if (archivo && archivo.size > 4 * 1024 * 1024) throw new Error('La portada alternativa debe pesar como máximo 4 MB.');
      const resultado: Copia[] = [];
      for (const [indice, fuente] of seleccion.entries()) {
        setProgreso(indice + 1);
        const params = new URLSearchParams({ id: ficha.id, version: String(ficha.ficha_version), fuente });
        const respuesta = await respuestaPrivada(userId, `/api/admin/material-publico?${params}`, {
          method: 'POST', ...(fuente === 'portada-alternativa' && archivo ? { body: archivo } : {}),
        });
        resultado.push(await respuesta.json());
      }
      setCopias(resultado);
    } catch (causa) { setError(causa instanceof Error ? causa.message : 'No se pudieron preparar las fotos.'); }
    finally { setPreparando(false); }
  };

  return <section className="space-y-3 rounded-xl border border-[var(--admin-border)] p-3" aria-label="Revisión de fotos públicas">
    <p>Ubicación pública: <strong>{ficha.ciudad_zona}</strong></p>
    <p>Elige hasta 12 fotos. Revisa las copias y comprueba que oculten el domicilio antes de publicarlas.</p>
    <fieldset disabled={ocupado || preparando} className="space-y-2">
      {ficha.fotos_drive.map((foto) => <label key={foto.id} className="flex min-h-11 items-center gap-2">
        <input type="checkbox" checked={seleccion.includes(foto.id)} disabled={foto.id === portada || (seleccion.length >= 12 && !seleccion.includes(foto.id))}
          onChange={(e) => { setSeleccion((actual) => e.target.checked ? [...actual, foto.id] : actual.filter((id) => id !== foto.id)); setRevisadas(false); setCopias([]); }} />
        <span className="break-all">{foto.name}{foto.id === portada ? ' · Portada' : ''}</span>
      </label>)}
      {portada === 'portada-alternativa' && <label className="block space-y-1">Copia de la portada alternativa (hasta 4 MB)
        <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(e) => {
          setArchivo(e.target.files?.[0] ?? null); setCopias([]); setRevisadas(false);
        }} />
      </label>}
      <button type="button" className="public-action" onClick={preparar} disabled={preparando || ocupado}>
        {preparando ? `Preparando foto ${progreso} de ${seleccion.length}…` : 'Preparar fotos públicas'}
      </button>
    </fieldset>
    {error && <p role="alert">{error}</p>}
    <div className="grid grid-cols-2 gap-3">{copias.map((copia) => <VistaCopia key={copia.id} copia={copia} userId={userId}
      alCargar={(id) => setCargadas((actuales) => actuales.includes(id) ? actuales : [...actuales, id])} />)}</div>
    <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={revisadas} disabled={!listas || preparando}
      onChange={(e) => setRevisadas(e.target.checked)} />Revisé las fotos públicas y ocultan el domicilio.</label>
    {ficha.estado === 'disponible' && <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={confirmada}
      onChange={(e) => setConfirmada(e.target.checked)} />Acabo de confirmar que sigue disponible</label>}
    <button type="button" className="admin-publish public-action public-action-primary w-full" disabled={!listas || !revisadas || preparando || ocupado}
      onClick={() => publicar({ portada_publica_id: copias.find((copia) => copia.fuente === portada)!.id,
        galeria_publica_ids: copias.map((copia) => copia.id), material_revisado: true, confirmar_disponibilidad: confirmada })}>
      {ocupado ? 'Guardando…' : ficha.publicada_en ? 'Confirmar revisión y actualizar fotos' : 'Confirmar revisión y publicar'}
    </button>
  </section>;
}
