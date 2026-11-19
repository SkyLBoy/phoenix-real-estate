'use client';

import { etiquetaDisponibilidad, type EstadoDisponibilidad } from '@/lib/disponibilidad';
import { useRelojDisponibilidad } from '@/lib/use-reloj-disponibilidad';

export function EtiquetaDisponibilidad({ estado, ultimaConfirmacion }: {
  estado: EstadoDisponibilidad;
  ultimaConfirmacion: string | null;
}) {
  const ahora = useRelojDisponibilidad();
  return (
    <p className="font-medium text-amber-300" suppressHydrationWarning>
      {etiquetaDisponibilidad(estado, ultimaConfirmacion, ahora)}
    </p>
  );
}
