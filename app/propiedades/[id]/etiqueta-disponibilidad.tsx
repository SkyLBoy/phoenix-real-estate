'use client';

import { etiquetaDisponibilidad, type EstadoDisponibilidad } from '@/lib/disponibilidad';
import { useRelojDisponibilidad } from '@/lib/use-reloj-disponibilidad';

export function EtiquetaDisponibilidad({ estado, ultimaConfirmacion }: {
  estado: EstadoDisponibilidad;
  ultimaConfirmacion: string | null;
}) {
  const ahora = useRelojDisponibilidad();
  const etiqueta = etiquetaDisponibilidad(estado, ultimaConfirmacion, ahora);
  const estilo = etiqueta === 'Por confirmar' ? 'status-pending' : estado !== 'disponible' ? 'status-inactive' : '';
  return (
    <p className={`status-pill ${estilo}`}>
      {etiqueta}
    </p>
  );
}
