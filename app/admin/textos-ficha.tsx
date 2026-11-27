'use client';

import { useState } from 'react';
import type { EstadoDisponibilidad } from '@/lib/disponibilidad';
import {
  canalesTexto, clavesCondiciones, clavesRasgos, condicionesTexto, MAX_TEXTO, mismasCondiciones,
  publicosTexto, rasgosPublicos, textosPropiedad,
  type CanalTexto, type CondicionesTexto, type TextosFicha,
} from '@/lib/textos-propiedad';

type PeticionTexto =
  | { accion: 'generar'; condiciones: CondicionesTexto; canal?: CanalTexto }
  | { accion: 'guardar' | 'aprobar'; canal: CanalTexto; texto: string };

function EditorTexto({ canal, texto, aprobado, ocupado, puedeGenerar, disponible, condicionesEditadas, generar, enviar }: {
  canal: CanalTexto;
  texto: string;
  aprobado: boolean;
  ocupado: boolean;
  puedeGenerar: boolean;
  disponible: boolean;
  condicionesEditadas: boolean;
  generar: (canal: CanalTexto, hayCambiosLocales: boolean) => void;
  enviar: (peticion: PeticionTexto) => Promise<void>;
}) {
  const [borrador, setBorrador] = useState(texto);
  const [avisoCopia, setAvisoCopia] = useState('');
  const cambio = borrador !== texto;
  const copiar = async () => {
    if (!disponible) return;
    try {
      await navigator.clipboard.writeText(texto);
      setAvisoCopia('Texto copiado.');
    } catch {
      setAvisoCopia('No se pudo copiar. Intenta de nuevo.');
    }
  };

  return (
    <div className="space-y-2 rounded-lg border border-[var(--admin-soft)] bg-[var(--admin-canvas)] p-3">
      <label className="block space-y-2">
        <span className="block font-medium">{textosPropiedad[canal]}</span>
        <span className="block text-xs text-[var(--admin-secondary)]">
          {cambio ? 'Cambios sin guardar' : aprobado ? 'Aprobado' : texto ? 'Pendiente de aprobación' : 'Sin texto'}
        </span>
        <textarea value={borrador} rows={9} maxLength={MAX_TEXTO} disabled={ocupado}
          onChange={(event) => {
            setBorrador(event.target.value);
            setAvisoCopia('');
          }}
          className="w-full rounded border border-[var(--admin-soft)] bg-[var(--admin-surface)] p-2" />
      </label>
      <div className="flex flex-wrap gap-3 text-sm [&>button]:text-[var(--admin-link)] [&>button:disabled]:text-[var(--admin-muted)]">
        <button type="button" disabled={ocupado || !puedeGenerar}
          aria-label={`${texto ? 'Regenerar' : 'Generar'} ${textosPropiedad[canal]}`} onClick={() => generar(canal, cambio)}>
          {texto ? 'Regenerar este texto' : 'Generar este texto'}
        </button>
        <button type="button" disabled={ocupado || !cambio || !borrador.trim()}
          onClick={() => void enviar({ accion: 'guardar', canal, texto: borrador })}>Guardar texto</button>
        <button type="button" disabled={!disponible || ocupado || condicionesEditadas || cambio || !texto || aprobado}
          onClick={() => void enviar({ accion: 'aprobar', canal, texto })}>Aprobar texto</button>
        <button type="button" disabled={!disponible || ocupado || condicionesEditadas || cambio || !aprobado || !texto}
          onClick={copiar}>Copiar texto final</button>
      </div>
      {avisoCopia && <p role="status" className="text-xs text-[var(--admin-body)]">{avisoCopia}</p>}
    </div>
  );
}

export function TextosDeFicha({ ficha, estado, zona, requisitos, editarBorrador, guardar }: {
  ficha: TextosFicha;
  estado: EstadoDisponibilidad;
  zona: string;
  requisitos: string[];
  editarBorrador?: () => void;
  guardar: (version: number, peticion: PeticionTexto) => Promise<{ origen?: string }>;
}) {
  const disponible = estado === 'disponible';
  const respuestaAlternativa = estado === 'en_contrato'
    ? `La propiedad en ${zona} está en contrato. ¿Quieres que busquemos otra opción en esa zona?`
    : `La propiedad en ${zona} ya no está disponible. ¿Quieres que busquemos otra opción en esa zona?`;
  const [avisoAlternativa, setAvisoAlternativa] = useState('');
  const condicionesServidor = ficha.condiciones_texto ?? {};
  const [condicionesBase, setCondicionesBase] = useState(condicionesServidor);
  const [condiciones, setCondiciones] = useState(condicionesServidor);
  const [enganche, setEnganche] = useState(String(condiciones.enganche ?? ''));
  if (!mismasCondiciones(condicionesBase, condicionesServidor)) {
    setCondicionesBase(condicionesServidor);
    setCondiciones(condicionesServidor);
    setEnganche(String(condicionesServidor.enganche ?? ''));
  }
  const [ocupado, setOcupado] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [fallo, setFallo] = useState('');
  const [generaciones, setGeneraciones] = useState<Partial<Record<CanalTexto, number>>>({});
  const paraGenerar = { ...condiciones, enganche: enganche.trim() ? Number(enganche) : undefined };
  const puedeGenerar = requisitos.length === 0 && (!enganche || (Number(enganche) > 0 && Number(enganche) <= 100));
  const condicionesEditadas = !mismasCondiciones(paraGenerar, condicionesServidor);

  const enviar = async (peticion: PeticionTexto) => {
    setOcupado(true);
    setMensaje('');
    setFallo('');
    try {
      const resultado = await guardar(ficha.textos_version ?? 0, peticion);
      if (peticion.accion === 'generar') {
        const afectados = peticion.canal ? [peticion.canal] : canalesTexto;
        setGeneraciones((actual) => {
          const siguiente = { ...actual };
          for (const canal of afectados) siguiente[canal] = (actual[canal] ?? 0) + 1;
          return siguiente;
        });
        const origen = resultado.origen === 'plantillas' ? 'plantilla de respaldo' : 'Gemini';
        setMensaje(peticion.canal
          ? `Borrador de ${textosPropiedad[peticion.canal]} generado con ${origen}. Revísalo antes de aprobarlo.`
          : `Cuatro borradores generados con ${origen}. Revísalos antes de aprobar.`);
      }
    } catch (error) {
      setFallo(error instanceof Error ? error.message : 'No se guardaron los cambios');
    } finally {
      setOcupado(false);
    }
  };

  const generar = (canal?: CanalTexto, hayCambiosLocales = false) => {
    if (canal) {
      const confirmar = hayCambiosLocales || ficha[canal] || (condicionesEditadas && canalesTexto.some((otro) => ficha[`${otro}_aprobado`]));
      const aviso = condicionesEditadas ? ' Los demás textos quedarán pendientes de revisión por el cambio de datos.' : '';
      if (confirmar && !confirm(`¿Generar un nuevo borrador de ${textosPropiedad[canal]}?${aviso}`)) return;
    } else if (canalesTexto.some((nombre) => ficha[nombre]) && !confirm('¿Reemplazar los cuatro textos y sus aprobaciones?')) return;
    void enviar({ accion: 'generar', canal, condiciones: paraGenerar });
  };

  return (
    <details className="space-y-3 text-sm">
      <summary className="cursor-pointer text-[var(--admin-link)]">Textos de la propiedad</summary>
      <fieldset disabled={ocupado} className="space-y-3">
        <legend className="font-medium">Condiciones confirmadas para esta ficha</legend>
        <div className="flex flex-wrap gap-3">
          {clavesCondiciones.map((campo) => (
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
              className="w-20 rounded border border-[var(--admin-soft)] bg-[var(--admin-canvas)] p-1" />
          </label>
        </div>
        <label className="grid gap-1">
          Público de los anuncios en ambos idiomas
          <select className="vip-input" value={condiciones.publico ?? 'mixto'} onChange={(evento) =>
            setCondiciones({ ...condiciones, publico: evento.target.value as keyof typeof publicosTexto })}>
            {Object.entries(publicosTexto).map(([valor, etiqueta]) => <option key={valor} value={valor}>{etiqueta}</option>)}
          </select>
        </label>
        <fieldset className="space-y-2">
          <legend className="font-medium">¿Qué destaca de esta casa?</legend>
          <p>Elige hasta dos características que hayas confirmado para el anuncio.</p>
          <div className="flex flex-wrap gap-3">
            {clavesRasgos.map((rasgo) => (
              <label key={rasgo} className="flex items-center gap-2">
                <input type="checkbox" checked={condiciones.rasgos?.includes(rasgo) ?? false}
                  disabled={(condiciones.rasgos?.length ?? 0) >= 2 && !condiciones.rasgos?.includes(rasgo)}
                  onChange={(evento) => {
                    const rasgos = condiciones.rasgos ?? [];
                    setCondiciones({ ...condiciones, rasgos: evento.target.checked
                      ? [...rasgos, rasgo] : rasgos.filter((valor) => valor !== rasgo) });
                  }} />
                {rasgosPublicos[rasgo].es}
              </label>
            ))}
          </div>
        </fieldset>
        {condicionesEditadas && <p className="text-[var(--admin-body)]">Genera un borrador para guardar los cambios. Los textos aprobados volverán a revisión.</p>}
        <button type="button" disabled={!puedeGenerar}
          onClick={() => generar()} className="rounded bg-[var(--admin-soft)] px-3 py-2 text-[var(--admin-link)] disabled:opacity-50">
          {ocupado ? 'Procesando…' : 'Generar cuatro textos'}
        </button>
      </fieldset>
      {!disponible && <div className="space-y-2 rounded-lg border border-[var(--admin-border)] p-3">
        <p>La ficha está fuera del inventario disponible. Puedes responder al interesado con este mensaje.</p>
        <textarea aria-label="Respuesta sobre la propiedad retirada" readOnly rows={3} value={respuestaAlternativa}
          className="w-full rounded border border-[var(--admin-border)] bg-[var(--admin-canvas)] p-2" />
        <button type="button" className="public-action" onClick={async () => {
          try {
            await navigator.clipboard.writeText(respuestaAlternativa);
            setAvisoAlternativa('Respuesta copiada.');
          } catch {
            setAvisoAlternativa('Selecciona el mensaje para copiarlo.');
          }
        }}>Copiar respuesta con alternativas</button>
        {avisoAlternativa && <p role="status">{avisoAlternativa}</p>}
      </div>}
      {requisitos.length > 0 && (
        <div className="space-y-2 text-[var(--admin-body)]">
          <ul className="list-inside list-disc">
            {requisitos.map((requisito) => <li key={requisito}>{requisito}</li>)}
          </ul>
          {editarBorrador && <a href="#formulario-ficha" onClick={editarBorrador} className="text-[var(--admin-link)]">Completar borrador</a>}
        </div>
      )}
      {mensaje && <p role="status" className="text-[var(--admin-body)]">{mensaje}</p>}
      {fallo && <p role="alert" className="text-[var(--admin-danger)]">{fallo}</p>}
      <div className="grid gap-4 xl:grid-cols-2">
        {canalesTexto.map((canal) => (
          <EditorTexto key={JSON.stringify([canal, ficha[canal], generaciones[canal]])}
            canal={canal} texto={ficha[canal] ?? ''} aprobado={ficha[`${canal}_aprobado`] === true}
            ocupado={ocupado} puedeGenerar={puedeGenerar} disponible={disponible} condicionesEditadas={condicionesEditadas}
            generar={generar} enviar={enviar} />
        ))}
      </div>
    </details>
  );
}
