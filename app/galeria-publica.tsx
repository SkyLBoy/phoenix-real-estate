'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PortadaPublica } from './portada-publica';

export function GaleriaPublica({ propiedad, portada = null, zona = 'la propiedad', detalle = false }: {
  propiedad: string; portada?: string | null; zona?: string; detalle?: boolean;
}) {
  const [fotos, setFotos] = useState<string[]>([]);
  const [indice, setIndice] = useState(0);
  const [error, setError] = useState('');
  const [intento, setIntento] = useState(0);
  const contenedor = useRef<HTMLElement>(null);
  const inicio = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const cargar = () => {
      fetch(`/api/propiedades/${encodeURIComponent(propiedad)}/fotos`, { signal: controller.signal, cache: 'no-store' })
        .then(async (respuesta) => {
          if (!respuesta.ok) throw new Error('No se pudo cargar la galería.');
          const datos = await respuesta.json();
          if (!controller.signal.aborted) {
            const lista = [...new Set<string>(datos.fotos)];
            setFotos(datos.portada && lista.includes(datos.portada) ? [datos.portada, ...lista.filter((foto) => foto !== datos.portada)] : lista);
            setIndice(0); setError('');
          }
        }).catch(() => { if (!controller.signal.aborted) setError('No se pudieron cargar las demás fotos.'); });
    };
    let observador: IntersectionObserver | undefined;
    if (detalle || typeof IntersectionObserver === 'undefined') cargar();
    else {
      observador = new IntersectionObserver((entradas) => {
        if (entradas.some((entrada) => entrada.isIntersecting)) { observador?.disconnect(); cargar(); }
      }, { rootMargin: '200px' });
      if (contenedor.current) observador.observe(contenedor.current);
    }
    return () => { controller.abort(); observador?.disconnect(); };
  }, [propiedad, intento, detalle]);
  const lista = fotos.length ? fotos : portada ? [portada] : [];
  const posicion = Math.min(indice, Math.max(0, lista.length - 1));
  const mover = (paso: number) => { if (lista.length > 1) setIndice((posicion + paso + lista.length) % lista.length); };
  return <section ref={contenedor} role="region" aria-roledescription="carrusel" aria-label={`Fotos de ${zona}`}
    className="min-w-0" tabIndex={lista.length > 1 ? 0 : undefined}
    onKeyDown={(event) => {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); mover(event.key === 'ArrowRight' ? 1 : -1); }
    }}>
    <div className={`listing-photo relative ${detalle ? 'listing-photo-detail rounded-xl' : ''}`}
      style={{ touchAction: 'pan-y' }}
      onTouchStart={(event) => { const toque = event.touches[0]; inicio.current = toque ? { x: toque.clientX, y: toque.clientY } : null; }}
      onTouchEnd={(event) => {
        const toque = event.changedTouches[0];
        if (inicio.current && toque) {
          const x = toque.clientX - inicio.current.x; const y = toque.clientY - inicio.current.y;
          if (Math.abs(x) > 45 && Math.abs(x) > Math.abs(y)) mover(x < 0 ? 1 : -1);
        }
        inicio.current = null;
      }}>
      <PortadaPublica src={lista[posicion] ?? null} zona={zona} detalle={detalle} descripcion={`Foto ${posicion + 1} de ${zona}`} />
      {lista.length > 1 && <>
        <button type="button" aria-label="Foto anterior" onClick={() => mover(-1)}
          className="absolute left-2 top-1/2 z-10 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-[#172c46]/90 text-white shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
          <ChevronLeft size={24} aria-hidden="true" />
        </button>
        <button type="button" aria-label="Foto siguiente" onClick={() => mover(1)}
          className="absolute right-2 top-1/2 z-10 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-[#172c46]/90 text-white shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
          <ChevronRight size={24} aria-hidden="true" />
        </button>
        <span aria-live="polite" aria-atomic="true" className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-[#172c46]/90 px-3 py-1 text-xs font-semibold tabular-nums text-white">
          {posicion + 1} / {lista.length}
        </span>
      </>}
    </div>
    {detalle && lista.length > 1 && <div className="mt-2 flex flex-wrap justify-center gap-1" role="group" aria-label="Elegir foto">
      {lista.map((foto, i) => <button key={foto} type="button" aria-label={`Ver foto ${i + 1}`} aria-pressed={i === posicion}
        onClick={() => setIndice(i)} className="grid h-11 w-11 place-items-center rounded-lg focus-visible:outline-2 focus-visible:outline-[#172c46]">
        <span className={`h-2.5 w-2.5 rounded-full ${i === posicion ? 'bg-[#172c46]' : 'bg-[#a79986]'}`} />
      </button>)}
    </div>}
    {error && <div role="alert" className="p-2 text-sm">{error} <button type="button" className="min-h-11 underline" onClick={() => setIntento((n) => n + 1)}>Reintentar fotos</button></div>}
  </section>;
}
