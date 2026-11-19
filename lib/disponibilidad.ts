export const estadosDisponibilidad = {
  disponible: 'Disponible',
  en_contrato: 'En contrato',
  vendida: 'Ya no disponible',
} as const;

export type EstadoDisponibilidad = keyof typeof estadosDisponibilidad;

export function esEstadoDisponibilidad(valor: unknown): valor is EstadoDisponibilidad {
  return typeof valor === 'string' && Object.hasOwn(estadosDisponibilidad, valor);
}

const plazoConfirmacion = 72 * 60 * 60 * 1000;

export function etiquetaDisponibilidad(
  estado: EstadoDisponibilidad,
  ultimaConfirmacion: string | null,
  ahora: number,
) {
  const confirmada = ultimaConfirmacion ? Date.parse(ultimaConfirmacion) : NaN;
  if (estado === 'disponible' && (!Number.isFinite(confirmada) || ahora - confirmada >= plazoConfirmacion)) {
    return 'Por confirmar';
  }
  return estadosDisponibilidad[estado];
}
