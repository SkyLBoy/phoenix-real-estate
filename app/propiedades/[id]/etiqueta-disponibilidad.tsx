'use client';

import { etiquetaDisponibilidad, type EstadoDisponibilidad } from '@/lib/disponibilidad';
import { useRelojDisponibilidad } from '@/lib/use-reloj-disponibilidad';

export function EtiquetaDisponibilidad({ estado, ultimaConfirmacion, ahoraInicial }: {
  estado: EstadoDisponibilidad;
  ultimaConfirmacion: string | null;
  ahoraInicial: number;
}) {
  const ahora = useRelojDisponibilidad(ahoraInicial);
  const etiqueta = etiquetaDisponibilidad(estado, ultimaConfirmacion, ahora);
  const estilo = etiqueta === 'Por confirmar' ? 'status-pending' : estado !== 'disponible' ? 'status-inactive' : '';
  return (
    <p className={`status-pill ${estilo}`}>
      {etiqueta}
    </p>
  );
}
