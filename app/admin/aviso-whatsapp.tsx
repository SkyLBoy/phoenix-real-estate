'use client';

import { useState } from 'react';
import { cargarFichasDelAviso, prepararAvisoWhatsApp } from '@/lib/aviso-whatsapp';

const estiloBoton = 'min-h-11 rounded-lg bg-[var(--admin-soft)] px-4 py-2 text-sm font-medium text-[var(--admin-link)] disabled:opacity-50';

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
      {mensaje && <p role="status" className="text-[var(--admin-body)]">{mensaje}</p>}
      {enlaceManual && (
        <input aria-label="Enlace de la ficha" type="url" readOnly value={enlaceManual}
          onFocus={(event) => event.currentTarget.select()}
          className="w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-canvas)] px-3 py-2" />
      )}
    </div>
  );
}

export function AvisoWhatsApp({ ahora, revision }: { ahora: number | null; revision: number }) {
  const [resumen, setResumen] = useState<{
    fichas: Awaited<ReturnType<typeof cargarFichasDelAviso>>;
    origen: string;
    revision: number;
  } | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const aviso = resumen ? prepararAvisoWhatsApp(resumen.fichas, resumen.origen, ahora) : '';

  const preparar = async () => {
    setCargando(true);
    setError('');
    setMensaje('');
    try {
      const fichas = await cargarFichasDelAviso();
      setResumen({ fichas, origen: window.location.origin, revision });
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
    <section aria-labelledby="titulo-aviso" className="space-y-3 rounded-2xl border border-[var(--admin-soft)] bg-[var(--admin-surface)] p-5">
      <h2 id="titulo-aviso" className="font-semibold text-[var(--admin-accent)]">Aviso diario de WhatsApp</h2>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={preparar} disabled={cargando} className={estiloBoton}>
          {cargando ? 'Preparando aviso…' : resumen ? 'Actualizar aviso' : 'Preparar aviso'}
        </button>
        {aviso && <button type="button" onClick={copiar} className={estiloBoton}>Copiar aviso</button>}
      </div>
      {error && <p role="alert" className="text-sm text-[var(--admin-danger)]">{error}</p>}
      {resumen && resumen.revision !== revision && (
        <p role="status" className="text-sm text-[var(--admin-link)]">El inventario cambió. Pulsa Actualizar aviso para incorporar los cambios.</p>
      )}
      {mensaje && <p role="status" className="text-sm text-[var(--admin-body)]">{mensaje}</p>}
      {resumen && !aviso && <p role="status" className="text-sm text-[var(--admin-body)]">No hay propiedades para compartir hoy.</p>}
      {aviso && (
        <textarea aria-label="Vista previa del aviso de WhatsApp" readOnly rows={7} value={aviso}
          onFocus={(event) => event.currentTarget.select()}
          className="w-full rounded-lg border border-[var(--admin-soft)] bg-[var(--admin-canvas)] p-3 text-sm" />
      )}
    </section>
  );
}
