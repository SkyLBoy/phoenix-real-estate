'use client';

import { useEffect, useState } from 'react';
import type { PaginaCatalogo } from './catalogo';

type Filtros = { ciudad: string; zip: string; pagina: number };
type Consulta = { filtros: Filtros; demora: number };

export function useCatalogo(datosIniciales: PaginaCatalogo | null) {
  const [consulta, setConsulta] = useState<Consulta | null>(datosIniciales ? null : {
    filtros: { ciudad: '', zip: '', pagina: 0 }, demora: 0,
  });
  const filtros = consulta?.filtros ?? { ciudad: '', zip: '', pagina: 0 };
  const [resultado, setResultado] = useState<PaginaCatalogo>(datosIniciales ?? {
    propiedades: [], total: 0, pagina: 0, porPagina: 12, precioDesde: null,
  });
  const [estado, setEstado] = useState<'cargando' | 'listo' | 'error'>(datosIniciales ? 'listo' : 'cargando');
  const [error, setError] = useState('');

  useEffect(() => {
    let ultimaActualizacion = -Infinity;
    const actualizar = () => {
      if (document.visibilityState !== 'visible' || performance.now() - ultimaActualizacion < 100) return;
      ultimaActualizacion = performance.now();
      setEstado('cargando');
      setConsulta((actual) => ({ filtros: actual?.filtros ?? { ciudad: '', zip: '', pagina: 0 }, demora: 0 }));
    };
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
    if (!consulta) return;
    const { filtros, demora } = consulta;
    const controller = new AbortController();
    const cargar = async () => {
      try {
        const params = new URLSearchParams({ ciudad: filtros.ciudad, zip: filtros.zip, pagina: String(filtros.pagina) });
        const respuesta = await fetch(`/api/catalogo?${params}`, { signal: controller.signal, cache: 'no-store' });
        const datos = await respuesta.json();
        if (!respuesta.ok) throw new Error(datos.error || 'No pudimos cargar las propiedades.');
        if (controller.signal.aborted) return;
        if (filtros.pagina > 0 && !datos.propiedades.length) {
          setConsulta({ filtros: { ...filtros, pagina: Math.max(0, Math.ceil(datos.total / datos.porPagina) - 1) }, demora: 0 });
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
    };
    const carga = demora ? window.setTimeout(cargar, demora) : undefined;
    if (!demora) void cargar();
    return () => { window.clearTimeout(carga); controller.abort(); };
  }, [consulta]);

  return { ...resultado, filtros, estado, error,
    cambiarFiltros: (ciudad: string, zip: string) => {
      setEstado('cargando');
      setConsulta({ filtros: { ciudad, zip, pagina: 0 }, demora: zip !== filtros.zip ? 200 : 0 });
    },
    cambiarPagina: (pagina: number) => {
      setEstado('cargando');
      setConsulta({ filtros: { ...filtros, pagina }, demora: 0 });
    },
    actualizar: () => {
      setEstado('cargando');
      setConsulta({ filtros, demora: 0 });
    },
  };
}
