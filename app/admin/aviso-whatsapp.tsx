'use client';

import { useState } from 'react';
import { cargarFichasDelAviso, prepararAvisoWhatsApp } from '@/lib/aviso-whatsapp';

const estiloBoton = 'min-h-11 rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-amber-300 disabled:opacity-50';

export function CopiarEnlaceFicha({ ruta }: { ruta: string }) {
  const [mensaje, setMensaje] = useState('');
  const [enlaceManual, setEnlaceManual] = useState('');

  const copiar = async () => {
    const enlace = new URL(ruta, window.location.origin).href;
    try {
      await navigator.clipboard.writeText(enlace);
      setMensaje('Enlace copiado.');
      setEnlaceManual('');
    } catch {
      setMensaje('Selecciona el enlace para copiarlo.');
      setEnlaceManual(enlace);
    }
  };

  return (
    <div className="space-y-1">
      <button type="button" onClick={copiar} className={estiloBoton}>Copiar enlace</button>
      {mensaje && <p role="status" className="text-zinc-300">{mensaje}</p>}
      {enlaceManual && (
        <input aria-label="Enlace de la ficha" type="url" readOnly value={enlaceManual}
          onFocus={(event) => event.currentTarget.select()}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2" />
      )}
    </div>
  );
}

export function AvisoWhatsApp({ ahora }: { ahora: number | null }) {
  const [resumen, setResumen] = useState<{
    fichas: Awaited<ReturnType<typeof cargarFichasDelAviso>>;
    origen: string;
  } | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const aviso = resumen ? prepararAvisoWhatsApp(resumen.fichas, resumen.origen, ahora) : '';

  const preparar = async () => {
    setResumen(null);
    setCargando(true);
    setError('');
    setMensaje('');
    try {
      const fichas = await cargarFichasDelAviso();
      setResumen({ fichas, origen: window.location.origin });
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : 'No se pudo preparar el aviso.');
    } finally {
      setCargando(false);
    }
  };

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(aviso);
      setMensaje('Aviso copiado. Pégalo en tu grupo de WhatsApp.');
    } catch {
      setMensaje('Selecciona el texto del aviso para copiarlo.');
    }
  };

  return (
    <section aria-labelledby="titulo-aviso" className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <h2 id="titulo-aviso" className="font-semibold text-amber-400">Aviso diario de WhatsApp</h2>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={preparar} disabled={cargando} className={estiloBoton}>
          {cargando ? 'Preparando aviso…' : resumen ? 'Actualizar aviso' : 'Preparar aviso'}
        </button>
        {aviso && <button type="button" onClick={copiar} className={estiloBoton}>Copiar aviso</button>}
      </div>
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      {mensaje && <p role="status" className="text-sm text-zinc-300">{mensaje}</p>}
      {resumen && !aviso && <p role="status" className="text-sm text-zinc-300">No hay propiedades para compartir hoy.</p>}
      {aviso && (
        <textarea aria-label="Vista previa del aviso de WhatsApp" readOnly rows={7} value={aviso}
          onFocus={(event) => event.currentTarget.select()}
          className="w-full rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-sm" />
      )}
    </section>
  );
}
