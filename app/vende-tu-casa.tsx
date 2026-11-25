'use client';

import { useState, type FormEvent } from 'react';
import { CamposCasaOfrecida, datosCasaOfrecida } from './campos-casa-ofrecida';

export function VendeTuCasa() {
  const [enviando, setEnviando] = useState(false);
  const [enviada, setEnviada] = useState(false);
  const [error, setError] = useState('');

  const enviar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    const datos = datosCasaOfrecida(evento.currentTarget);
    setEnviando(true);
    setError('');
    try {
      const respuesta = await fetch('/api/casas-ofrecidas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos),
      });
      if (!respuesta.ok) {
        const detalle = await respuesta.json().catch(() => null);
        throw new Error(detalle?.error || 'No se pudo enviar tu propiedad. Intenta de nuevo.');
      }
      setEnviada(true);
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : 'No se pudo enviar tu propiedad. Intenta de nuevo.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <section id="vende-tu-casa" aria-labelledby="titulo-venta" className="public-wrap scroll-mt-5 pb-8 md:pb-12">
      <div className="public-panel grid gap-6 border-t-4 border-t-[#b47854] p-5 md:p-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.65fr)]">
        <div className="space-y-3">
          <h2 id="titulo-venta" className="editorial-title text-4xl">Vende tu casa</h2>
          <p className="max-w-[36ch] leading-relaxed text-[var(--muted)]">
            ¿Quieres vender tu casa en Arizona? Cuéntame sobre la propiedad. Te contactaré por WhatsApp.
          </p>
          <p className="max-w-[36ch] text-sm leading-relaxed text-[var(--muted)]">
            Tu solicitud es privada.
          </p>
        </div>
        {enviada ? (
          <p role="status" className="self-start rounded-lg bg-emerald-50 p-4 text-emerald-900">
            He recibió tu propiedad para revisión. Si necesito más información, te escribire al WhatsApp que compartiste.
          </p>
        ) : (
          <form onSubmit={enviar} className="space-y-3">
            {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
            <CamposCasaOfrecida ocupado={enviando} accion="Ofrecer mi propiedad" />
          </form>
        )}
      </div>
    </section>
  );
}
