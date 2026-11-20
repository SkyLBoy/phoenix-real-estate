'use client';

import { useState } from 'react';
import {
  canalesTexto, condicionesTexto, MAX_TEXTO, textosPropiedad,
  type CanalTexto, type CondicionesTexto, type TextosFicha,
} from '@/lib/textos-propiedad';

type PeticionTexto =
  | { accion: 'generar'; condiciones: CondicionesTexto }
  | { accion: 'guardar' | 'aprobar'; canal: CanalTexto; texto: string };

function EditorTexto({ canal, texto, aprobado, ocupado, enviar }: {
  canal: CanalTexto;
  texto: string;
  aprobado: boolean;
  ocupado: boolean;
  enviar: (peticion: PeticionTexto) => Promise<void>;
}) {
  const [borrador, setBorrador] = useState(texto);
  const [avisoCopia, setAvisoCopia] = useState('');
  const cambio = borrador !== texto;
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      setAvisoCopia('Texto copiado.');
    } catch {
      setAvisoCopia('No se pudo copiar. Intenta de nuevo.');
    }
  };

  return (
    <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-950 p-3">
      <label className="block space-y-2">
        <span className="block font-medium">{textosPropiedad[canal]}</span>
        <span className="block text-xs text-zinc-400">
          {cambio ? 'Cambios sin guardar' : aprobado ? 'Aprobado' : texto ? 'Pendiente de aprobación' : 'Sin texto'}
        </span>
        <textarea value={borrador} rows={4} maxLength={MAX_TEXTO} disabled={ocupado}
          onChange={(event) => {
            setBorrador(event.target.value);
            setAvisoCopia('');
          }}
          className="w-full rounded border border-zinc-800 bg-zinc-900 p-2" />
      </label>
      <div className="flex flex-wrap gap-3 text-sm [&>button]:text-amber-300 [&>button:disabled]:text-zinc-500">
        <button type="button" disabled={ocupado || !cambio || !borrador.trim()}
          onClick={() => void enviar({ accion: 'guardar', canal, texto: borrador })}>Guardar texto</button>
        <button type="button" disabled={ocupado || cambio || !texto || aprobado}
          onClick={() => void enviar({ accion: 'aprobar', canal, texto })}>Aprobar texto</button>
        <button type="button" disabled={ocupado || cambio || !aprobado || !texto}
          onClick={copiar}>Copiar texto final</button>
      </div>
      {avisoCopia && <p role="status" className="text-xs text-zinc-300">{avisoCopia}</p>}
    </div>
  );
}

export function TextosDeFicha({ ficha, requisitos, editarBorrador, guardar }: {
  ficha: TextosFicha;
  requisitos: string[];
  editarBorrador?: () => void;
  guardar: (version: number, peticion: PeticionTexto) => Promise<{ origen?: string }>;
}) {
  const [condiciones, setCondiciones] = useState(ficha.condiciones_texto ?? {});
  const [enganche, setEnganche] = useState(String(condiciones.enganche ?? ''));
  const [ocupado, setOcupado] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [fallo, setFallo] = useState('');
  const [generaciones, setGeneraciones] = useState(0);

  const enviar = async (peticion: PeticionTexto) => {
    setOcupado(true);
    setMensaje('');
    setFallo('');
    try {
      const resultado = await guardar(ficha.textos_version ?? 0, peticion);
      if (peticion.accion === 'generar') {
        setGeneraciones((total) => total + 1);
        setMensaje(resultado.origen === 'plantillas'
          ? 'Borradores creados con plantillas. Revísalos antes de aprobar.'
          : 'Borradores generados. Revísalos antes de aprobar.');
      }
    } catch (error) {
      setFallo(error instanceof Error ? error.message : 'No se guardaron los cambios');
    } finally {
      setOcupado(false);
    }
  };

  const generar = () => {
    if (canalesTexto.some((canal) => ficha[canal]) && !confirm('¿Reemplazar los cuatro textos guardados y sus aprobaciones?')) return;
    void enviar({
      accion: 'generar',
      condiciones: { ...condiciones, enganche: enganche.trim() ? Number(enganche) : undefined },
    });
  };

  return (
    <details className="space-y-3 text-sm">
      <summary className="cursor-pointer text-amber-300">Textos de la propiedad</summary>
      <fieldset disabled={ocupado} className="space-y-3">
        <legend className="font-medium">Condiciones confirmadas para esta ficha</legend>
        <div className="flex flex-wrap gap-3">
          {(Object.keys(condicionesTexto) as (keyof typeof condicionesTexto)[]).map((campo) => (
            <label key={campo} className="flex items-center gap-2">
              <input type="checkbox" checked={condiciones[campo] === true}
                onChange={(event) => setCondiciones({ ...condiciones, [campo]: event.target.checked })} />
              {condicionesTexto[campo]}
            </label>
          ))}
          <label className="flex items-center gap-2">
            Enganche (%)
            <input type="number" min="0.01" max="100" step="0.01" value={enganche}
              onChange={(event) => setEnganche(event.target.value)}
              className="w-20 rounded border border-zinc-800 bg-zinc-950 p-1" />
          </label>
        </div>
        <button type="button" disabled={requisitos.length > 0 || Boolean(enganche && (Number(enganche) <= 0 || Number(enganche) > 100))}
          onClick={generar} className="rounded bg-zinc-800 px-3 py-2 text-amber-300 disabled:opacity-50">
          {ocupado ? 'Procesando…' : 'Generar cuatro textos'}
        </button>
      </fieldset>
      {requisitos.length > 0 && (
        <div className="space-y-2 text-zinc-300">
          <ul className="list-inside list-disc">
            {requisitos.map((requisito) => <li key={requisito}>{requisito}</li>)}
          </ul>
          {editarBorrador && <a href="#formulario-ficha" onClick={editarBorrador} className="text-amber-300">Completar borrador</a>}
        </div>
      )}
      {mensaje && <p role="status" className="text-zinc-300">{mensaje}</p>}
      {fallo && <p role="alert" className="text-red-300">{fallo}</p>}
      <div className="grid gap-3 md:grid-cols-2">
        {canalesTexto.map((canal) => (
          <EditorTexto key={JSON.stringify([canal, ficha[canal], generaciones])}
            canal={canal} texto={ficha[canal] ?? ''} aprobado={ficha[`${canal}_aprobado`] === true}
            ocupado={ocupado} enviar={enviar} />
        ))}
      </div>
    </details>
  );
}
