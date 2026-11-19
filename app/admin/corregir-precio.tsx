'use client';

import { useState, type FormEvent } from 'react';

export function CorregirPrecio({ precio, guardar }: {
  precio: number;
  guardar: (importe: number) => Promise<void>;
}) {
  const [importe, setImporte] = useState(String(precio));
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');

  const enviar = async (event: FormEvent) => {
    event.preventDefault();
    setGuardando(true);
    setMensaje('');
    setError('');
    try {
      await guardar(Number(importe));
      setMensaje('Precio actualizado. Revisa los textos antes de volver a aprobarlos.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar el precio.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <details className="space-y-2 text-sm">
      <summary className="cursor-pointer text-amber-300">Corregir precio</summary>
      <form onSubmit={enviar} className="flex flex-wrap items-end gap-3">
        <label className="space-y-1">
          <span className="block">Nuevo precio en USD</span>
          <input type="number" min="0.01" step="0.01" required value={importe} disabled={guardando}
            onChange={(event) => {
              setImporte(event.target.value);
              setMensaje('');
            }}
            className="min-h-11 w-36 rounded-lg border border-zinc-700 bg-zinc-950 px-3" />
        </label>
        <button type="submit" disabled={guardando || !importe || Number(importe) === precio}
          className="min-h-11 rounded-lg bg-zinc-800 px-3 text-amber-300 disabled:opacity-50">
          {guardando ? 'Guardando…' : 'Guardar precio'}
        </button>
      </form>
      {mensaje && <p role="status" className="text-zinc-300">{mensaje}</p>}
      {error && <p role="alert" className="text-red-300">{error}</p>}
    </details>
  );
}
