'use client';

import { useEffect, useState } from 'react';

export function GaleriaPublica({ propiedad }: { propiedad: string }) {
  const [fotos, setFotos] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [intento, setIntento] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/propiedades/${encodeURIComponent(propiedad)}/fotos`, { signal: controller.signal, cache: 'no-store' })
      .then(async (respuesta) => {
        if (!respuesta.ok) throw new Error('No se pudo cargar la galería.');
        const datos = await respuesta.json();
        if (!controller.signal.aborted) { setFotos(datos.fotos); setError(''); }
      }).catch(() => { if (!controller.signal.aborted) setError('No se pudo cargar la galería.'); });
    return () => controller.abort();
  }, [propiedad, intento]);
  return <section aria-label="Fotos de la propiedad" className="space-y-3">
    {error ? <div role="alert">{error} <button type="button" className="public-action" onClick={() => setIntento((n) => n + 1)}>Reintentar fotos</button></div>
      : fotos.length > 0 && <><h2 className="editorial-title text-2xl">Fotos de la propiedad</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{fotos.map((url, i) => <a key={url} href={url} target="_blank" rel="noopener noreferrer" aria-label={`Abrir foto ${i + 1}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={`Foto ${i + 1} de la propiedad`} loading="lazy" width={800} height={600} className="aspect-[4/3] w-full rounded-lg object-cover" />
        </a>)}</div></>}
  </section>;
}
