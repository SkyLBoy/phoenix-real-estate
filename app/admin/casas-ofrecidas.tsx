'use client';

import { useState, type FormEvent } from 'react';
import { chatComprador } from '@/lib/compradores-vip';
import { condicionesCasa, estadosOferta, type CasaOfrecida } from '@/lib/casas-ofrecidas';
import { CamposCasaOfrecida, datosCasaOfrecida } from '../campos-casa-ofrecida';
import { importeUsd } from '../metricas-propiedad';

type Solicitar = <T>(opciones?: RequestInit, pagina?: number) => Promise<T>;
const campo = 'vip-input block';

export function CasasOfrecidas({ solicitar }: { solicitar: Solicitar }) {
  const [casas, setCasas] = useState<CasaOfrecida[] | null>(null);
  const [pagina, setPagina] = useState(0);
  const [hayMas, setHayMas] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');

  const cargar = async (destino: number) => {
    const resultado = await solicitar<{ casas: CasaOfrecida[]; hayMas: boolean }>(undefined, destino);
    setCasas(resultado.casas);
    setHayMas(resultado.hayMas);
    setPagina(destino);
  };

  const ejecutar = async (accion: () => Promise<void>) => {
    setOcupado(true);
    setAviso('');
    setError('');
    try {
      await accion();
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : 'No se pudo completar la operación.');
    } finally {
      setOcupado(false);
    }
  };

  const registrar = (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    const datos = datosCasaOfrecida(formulario);
    void ejecutar(async () => {
      await solicitar({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos),
      });
      formulario.reset();
      setAviso('Casa ofrecida registrada.');
      await cargar(0);
    });
  };

  const cambiarEstado = (id: string, estado: string) => ejecutar(async () => {
    const { casa } = await solicitar<{ casa: CasaOfrecida }>({
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, estado }),
    });
    setCasas((actuales) => actuales?.map((item) => item.id === id ? casa : item) ?? null);
    setAviso('Estado actualizado.');
  });

  return (
    <section className="public-panel space-y-4 p-4 sm:p-5" aria-labelledby="titulo-casas-ofrecidas">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="titulo-casas-ofrecidas" className="editorial-title text-2xl">Casas ofrecidas</h2>
        <button type="button" className="public-action" disabled={ocupado} onClick={() => ejecutar(() => cargar(0))}>
          {casas ? 'Actualizar bandeja' : 'Ver casas ofrecidas'}
        </button>
      </header>
      <details className="rounded-xl border border-[var(--line)] bg-white px-3">
        <summary className="cursor-pointer font-semibold">Registrar una casa ofrecida</summary>
        <form onSubmit={registrar} className="pb-4">
          <CamposCasaOfrecida ocupado={ocupado} accion="Guardar casa ofrecida" />
        </form>
      </details>

      {ocupado && <p role="status" className="text-sm">Procesando…</p>}
      {aviso && <p role="status" className="text-sm">{aviso}</p>}
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      {casas?.length === 0 && <p className="text-sm text-zinc-400">No hay casas ofrecidas en esta página.</p>}
      {casas && casas.length > 0 && (
        <ul className="grid gap-3 md:grid-cols-2">
          {casas.map((casa) => {
            const chat = chatComprador(casa.whatsapp);
            return (
              <li key={casa.id} className="inventario-ficha rounded-xl border border-[var(--line)] p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h3 className="break-words text-lg font-semibold">{casa.zona}</h3>
                  <span className="status-pill status-inactive">{estadosOferta[casa.estado]}</span>
                </div>
                <p className="text-sm text-zinc-400">{condicionesCasa[casa.condicion]}</p>
                <p className="mt-2 font-semibold tabular-nums">
                  {casa.precio_esperado == null ? 'Precio sin definir' : `${importeUsd(casa.precio_esperado)} USD`}
                </p>
                <p className="mt-2 break-words text-sm">{casa.nombre} · {casa.whatsapp}</p>
                {casa.plazo && <p className="break-words text-sm">Plazo: {casa.plazo}</p>}
                {casa.notas && <p className="mt-2 whitespace-pre-wrap break-words text-sm">{casa.notas}</p>}
                <div className="mt-4 grid gap-2">
                  {chat && <a href={chat} target="_blank" rel="noopener noreferrer" className="public-action public-action-primary">Contactar por WhatsApp</a>}
                  {casa.fotos_url && <a href={casa.fotos_url} target="_blank" rel="noopener noreferrer" className="public-action">Ver fotos</a>}
                  <label className="space-y-1 text-sm">Estado de la oferta
                    <select value={casa.estado} className={campo} disabled={ocupado} onChange={(event) => cambiarEstado(casa.id, event.target.value)}>
                      {Object.entries(estadosOferta).map(([clave, estado]) => <option key={clave} value={clave}>{estado}</option>)}
                    </select>
                  </label>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {(pagina > 0 || hayMas) && (
        <nav className="flex flex-wrap items-center gap-2" aria-label="Páginas de casas ofrecidas">
          <button type="button" className="public-action" disabled={ocupado || pagina === 0} onClick={() => ejecutar(() => cargar(pagina - 1))}>Anterior</button>
          <span className="text-sm">Página {pagina + 1}</span>
          <button type="button" className="public-action" disabled={ocupado || !hayMas} onClick={() => ejecutar(() => cargar(pagina + 1))}>Siguiente</button>
        </nav>
      )}
    </section>
  );
}
