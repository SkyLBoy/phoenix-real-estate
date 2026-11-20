'use client';

import { ImageOff } from 'lucide-react';
import { useState } from 'react';

export function PortadaPublica({ src, zona, detalle = false }: {
  src: string | null;
  zona: string;
  detalle?: boolean;
}) {
  const [fallida, setFallida] = useState<string | null>(null);

  if (!src || fallida === src) {
    return (
      <div className="grid place-items-center gap-2 px-4 text-center text-sm text-[var(--muted)]">
        <ImageOff size={23} aria-hidden="true" />
        <span>{src ? 'Portada no disponible por el momento' : 'Portada pendiente'}</span>
      </div>
    );
  }

  // Las portadas usan fuentes externas dinámicas.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={`Portada de propiedad en ${zona}`}
    width={detalle ? 1600 : 800} height={detalle ? 900 : 600}
    loading={detalle ? 'eager' : 'lazy'} fetchPriority={detalle ? 'high' : undefined}
    onError={() => setFallida(src)} />;
}
