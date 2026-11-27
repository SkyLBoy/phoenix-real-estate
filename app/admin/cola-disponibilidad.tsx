'use client';

import { useEffect, useState } from 'react';
import type { EstadoDisponibilidad } from '@/lib/disponibilidad';

type FichaPendiente = {
  id: string;
  ciudad_zona: string;
  direccion_privada: string | null;
  ultima_confirmacion: string | null;
};

export type PaginaPendientes = { propiedades: FichaPendiente[]; hayMas: boolean };
const fechaPhoenix = new Intl.DateTimeFormat('es-MX', {
  dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Phoenix',
});
const boton = 'min-h-11 rounded-lg bg-[var(--admin-soft)] px-3 text-sm disabled:opacity-50';

export function ColaDisponibilidad({ cargar, actualizar, ocupadas, revision }: {
  cargar: (pagina: number, signal: AbortSignal) => Promise<PaginaPendientes>;
  actualizar: (id: string, estado: EstadoDisponibilidad) => Promise<void>;
  ocupadas: Set<string>;
  revision: number;
}) {
  const [pagina, setPagina] = useState(0);
  const [reintento, setReintento] = useState(0);
  const [resultado, setResultado] = useState<PaginaPendientes | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    cargar(pagina, controller.signal).then((datos) => {
      if (!controller.signal.aborted) {
        if (pagina > 0 && !datos.propiedades.length) {
          setResultado(null);
          setPagina(pagina - 1);
          return;
        }
        setResultado(datos);
        setError('');
      }
    }).catch((fallo: unknown) => {
      if (!controller.signal.aborted) setError(fallo instanceof Error ? fallo.message : 'No se pudieron cargar las fichas pendientes.');
    });
    return () => controller.abort();
  }, [cargar, pagina, reintento, revision]);

  function irA(nueva: number) {
    setResultado(null);
    setError('');
    setPagina(nueva);
  }

  return (
    <section aria-labelledby="titulo-pendientes" className="inventario-ficha space-y-3 rounded-2xl border p-4">
      <h3 id="titulo-pendientes" className="text-lg font-semibold">Por confirmar</h3>
      {error ? <div role="alert">{error} <button type="button" className={boton}
        onClick={() => setReintento((valor) => valor + 1)}>Reintentar</button></div>
        : !resultado ? <p role="status">Buscando fichas pendientes…</p>
        : !resultado.propiedades.length ? <p>No hay fichas pendientes en esta página.</p>
        : <ul className="space-y-3">{resultado.propiedades.map((ficha) => (
          <li key={ficha.id} className="space-y-2 border-t pt-3">
            <strong>{ficha.ciudad_zona}</strong>
            {ficha.direccion_privada && <span> · {ficha.direccion_privada} (privada)</span>}
            <p className="text-sm">{ficha.ultima_confirmacion
              ? `Última confirmación el ${fechaPhoenix.format(new Date(ficha.ultima_confirmacion))} (Phoenix).`
              : 'Sin confirmación registrada.'}</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={boton} disabled={ocupadas.has(ficha.id)}
                onClick={() => actualizar(ficha.id, 'disponible')}>Confirmar disponible</button>
              <button type="button" className={boton} disabled={ocupadas.has(ficha.id)}
                onClick={() => actualizar(ficha.id, 'en_contrato')}>En contrato</button>
              <button type="button" className={boton} disabled={ocupadas.has(ficha.id)}
                onClick={() => actualizar(ficha.id, 'vendida')}>Ya no disponible</button>
            </div>
          </li>
        ))}</ul>}
      {(pagina > 0 || resultado?.hayMas) && <div className="flex items-center gap-3">
        <button type="button" className={boton} disabled={pagina === 0} onClick={() => irA(pagina - 1)}>Anterior</button>
        <span>Página {pagina + 1}</span>
        <button type="button" className={boton} disabled={!resultado?.hayMas} onClick={() => irA(pagina + 1)}>Siguiente</button>
      </div>}
    </section>
  );
}
