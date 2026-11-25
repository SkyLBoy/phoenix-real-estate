'use client';

import { useEffect, useState } from 'react';
import type { PropiedadPublica } from './propiedades-publicas';

type Filtros = { ciudad: string; zip: string; pagina: number };
type Pagina = { propiedades: PropiedadPublica[]; total: number; pagina: number; porPagina: number };

export function useCatalogo() {
  const [filtros, setFiltros] = useState<Filtros>({ ciudad: '', zip: '', pagina: 0 });
  const [resultado, setResultado] = useState<Pagina>({ propiedades: [], total: 0, pagina: 0, porPagina: 12 });
  const [estado, setEstado] = useState<'cargando' | 'listo' | 'error'>('cargando');
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const actualizar = () => { if (document.visibilityState === 'visible') setRevision((n) => n + 1); };
    window.addEventListener('focus', actualizar);
    document.addEventListener('visibilitychange', actualizar);
    const intervalo = window.setInterval(actualizar, 60000);
    return () => {
      window.removeEventListener('focus', actualizar);
      document.removeEventListener('visibilitychange', actualizar);
      window.clearInterval(intervalo);
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const carga = window.setTimeout(async () => {
      setEstado('cargando');
      try {
        const params = new URLSearchParams({ ciudad: filtros.ciudad, zip: filtros.zip, pagina: String(filtros.pagina) });
        const respuesta = await fetch(`/api/catalogo?${params}`, { signal: controller.signal, cache: 'no-store' });
        const datos = await respuesta.json();
        if (!respuesta.ok) throw new Error(datos.error || 'No pudimos cargar las propiedades.');
        if (controller.signal.aborted) return;
        if (filtros.pagina > 0 && !datos.propiedades.length) {
          setFiltros((actual) => ({ ...actual, pagina: Math.max(0, Math.ceil(datos.total / datos.porPagina) - 1) }));
          return;
        }
        setResultado(datos);
        setError('');
        setEstado('listo');
      } catch (fallo) {
        if (!controller.signal.aborted) {
          setError(fallo instanceof Error ? fallo.message : 'No pudimos cargar las propiedades.');
          setEstado('error');
        }
      }
    }, 200);
    return () => { window.clearTimeout(carga); controller.abort(); };
  }, [filtros, revision]);

  return { ...resultado, filtros, estado, error,
    cambiarFiltros: (ciudad: string, zip: string) => { setEstado('cargando'); setFiltros({ ciudad, zip, pagina: 0 }); },
    cambiarPagina: (pagina: number) => { setEstado('cargando'); setFiltros((actual) => ({ ...actual, pagina })); },
    actualizar: () => { setEstado('cargando'); setRevision((n) => n + 1); },
  };
}
