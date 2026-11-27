'use client';

import { useState } from 'react';
import { chatComprador, perfilesVip, type CompradorVip } from '@/lib/compradores-vip';

type PaginaVip = { compradores: CompradorVip[]; hayMas: boolean };

export function CompradoresVip({ cargar }: { cargar: (pagina: number) => Promise<PaginaVip> }) {
  const [compradores, setCompradores] = useState<CompradorVip[] | null>(null);
  const [pagina, setPagina] = useState(0);
  const [hayMas, setHayMas] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  const consultar = async (siguiente: number) => {
    setCargando(true);
    setError('');
    try {
      const resultado = await cargar(siguiente);
      setCompradores(resultado.compradores);
      setHayMas(resultado.hayMas);
      setPagina(siguiente);
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : 'No se pudieron cargar los compradores.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <section className="space-y-3 rounded-2xl border border-[var(--admin-soft)] bg-[var(--admin-surface)] p-5" aria-labelledby="titulo-compradores-vip">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="titulo-compradores-vip" className="font-semibold text-[var(--admin-accent)]">Compradores VIP</h2>
        <button type="button" disabled={cargando} onClick={() => consultar(0)}
          className="min-h-11 rounded-lg bg-[var(--admin-soft)] px-3 text-sm text-[var(--admin-link)] disabled:opacity-50">
          {cargando ? 'Cargando…' : compradores ? 'Actualizar compradores' : 'Ver compradores'}
        </button>
      </div>
      {error && <p role="alert" className="text-sm text-[var(--admin-danger)]">{error}</p>}
      {compradores?.length === 0 && <p role="status" className="text-sm text-[var(--admin-body)]">No hay compradores en esta página.</p>}
      {compradores && (
        <ul className="divide-y divide-[var(--admin-soft)]">
          {compradores.map((comprador) => {
            const enlace = chatComprador(comprador.whatsapp);
            return (
              <li key={comprador.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="space-y-1 break-words text-sm">
                  <p className="font-semibold">{comprador.nombre}</p>
                  <p className="text-[var(--admin-body)]">{comprador.whatsapp} · {perfilesVip[comprador.perfil] ?? 'Perfil sin clasificar'}</p>
                  <p className="text-[var(--admin-secondary)]">{comprador.tiene_itin ? 'Indicó ITIN, pasaporte o enganche' : 'Sin indicación de ITIN, pasaporte o enganche'}</p>
                </div>
                {enlace ? (
                  <a href={enlace} target="_blank" rel="noopener noreferrer"
                    aria-label={`Abrir WhatsApp con ${comprador.nombre}`}
                    className="inline-flex min-h-11 items-center rounded-lg bg-[var(--admin-success)] px-3 text-sm font-medium text-white">
                    Abrir WhatsApp
                  </a>
                ) : <span className="text-sm text-[var(--admin-secondary)]">Número sin formato válido</span>}
              </li>
            );
          })}
        </ul>
      )}
      {(pagina > 0 || hayMas) && (
        <nav aria-label="Páginas de compradores VIP" className="flex flex-wrap items-center gap-3 text-sm">
          <button type="button" disabled={cargando || pagina === 0} onClick={() => consultar(pagina - 1)}
            className="min-h-11 px-2 text-[var(--admin-link)] disabled:opacity-50">Anterior</button>
          <span>Página {pagina + 1}</span>
          <button type="button" disabled={cargando || !hayMas} onClick={() => consultar(pagina + 1)}
            className="min-h-11 px-2 text-[var(--admin-link)] disabled:opacity-50">Siguiente</button>
        </nav>
      )}
    </section>
  );
}
