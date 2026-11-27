'use client';

import { Sparkles } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { solicitar } from '@/lib/api-admin';
import { separarUbicacion, unirUbicacion } from '@/lib/ciudades-phoenix';
import type { FotoDrivePanel as FotoDrive } from '@/lib/fotos-drive';
import { limitesEnterosFicha, type Propiedad } from '@/lib/propiedad-admin';
import { SelectorCiudad } from '../selector-ciudad';
import { camposPegables, leerDatosPegados, type CampoPegable } from './datos-pegados';
import { SelectorFotosDrive } from './fotos-drive';
import type { useDrivePanel } from './use-drive-panel';

export function FormularioFicha({ userId, borrador, drive, cancelar, alGuardar, limpiarError, mostrarError }: {
  userId: string;
  borrador?: Propiedad;
  drive: ReturnType<typeof useDrivePanel>;
  cancelar: () => void;
  alGuardar: (creado: boolean) => void;
  limpiarError: () => void;
  mostrarError: (error: unknown, mensaje: string) => void;
}) {
  const { listarFotos, abrirFoto, abrirOriginal } = drive;
  const editando = borrador?.id;
  const [generando, setGenerando] = useState(false);
  const [notasExtra, setNotasExtra] = useState(borrador?.notas_extra ?? '');
  const [direccionPrivada, setDireccionPrivada] = useState(borrador?.direccion_privada ?? '');
  const [ciudadZona, setZonaOriginal] = useState(borrador?.ciudad_zona ?? '');
  const [ciudad, setCiudad] = useState(() => separarUbicacion(ciudadZona).ciudad);
  const [zip, setZip] = useState(() => separarUbicacion(ciudadZona).zip);
  const setCiudadZona = (zona: string) => {
    const ubicacion = separarUbicacion(zona);
    setZonaOriginal(zona);
    setCiudad(ubicacion.ciudad);
    setZip(ubicacion.zip);
  };
  const [precio, setPrecio] = useState(String(borrador?.precio ?? ''));
  const [arv, setArv] = useState(String(borrador?.arv ?? ''));
  const [beds, setBeds] = useState(String(borrador?.beds ?? ''));
  const [baths, setBaths] = useState(String(borrador?.baths ?? ''));
  const [sqft, setSqft] = useState(String(borrador?.sqft ?? ''));
  const [lotSize, setLotSize] = useState(borrador?.lot_size ?? '');
  const [yearBuilt, setYearBuilt] = useState(String(borrador?.year_built ?? ''));
  const [driveUrl, setDriveUrl] = useState(borrador?.drive_url ?? '');
  const [imagenPortada, setImagenPortada] = useState(borrador?.imagen_portada ?? '');
  const [fotosDrive, setFotosDrive] = useState<FotoDrive[]>(borrador?.fotos_drive ?? []);
  const [portadaDrive, setPortadaDrive] = useState<string | null>(borrador?.portada_drive_id ?? null);

  const [bloqueDatos, setBloqueDatos] = useState('');
  const [resultadoPegado, setResultadoPegado] = useState<{
    reconocidos: CampoPegable[];
    conservados: CampoPegable[];
    revisar: CampoPegable[];
    arvConMas: boolean;
    advertencias: string[];
  } | null>(null);

  const camposFormulario = {
    direccionPrivada: [direccionPrivada, setDireccionPrivada],
    ciudadZona: [ciudadZona, setCiudadZona],
    precio: [precio, setPrecio],
    arv: [arv, setArv],
    beds: [beds, setBeds],
    baths: [baths, setBaths],
    sqft: [sqft, setSqft],
    lotSize: [lotSize, setLotSize],
    yearBuilt: [yearBuilt, setYearBuilt],
  } as const;
  const camposFaltantes = (Object.keys(camposFormulario) as CampoPegable[])
    .filter((campo) => !camposFormulario[campo][0].trim());

  const aplicarDatosPegados = () => {
    const { valores, revisar, arvConMas, driveUrl: enlace, notasExtra: notas, advertencias } = leerDatosPegados(bloqueDatos);
    const reconocidos = Object.keys(valores) as CampoPegable[];
    const conservados: CampoPegable[] = [];
    for (const campo of reconocidos) {
      const [actual, actualizar] = camposFormulario[campo];
      const valor = valores[campo]!;
      if (!actual.trim()) actualizar(valor);
      else if (actual !== valor) conservados.push(campo);
    }
    if (enlace && !driveUrl.trim()) setDriveUrl(enlace);
    else if (enlace && enlace !== driveUrl) advertencias.push('Se conservó la carpeta de Drive que ya estaba en el formulario.');
    if (notas && !notasExtra.trim()) setNotasExtra(notas);
    else if (notas && notas !== notasExtra) advertencias.push('Se conservaron las notas que ya estaban en el formulario. Revisa el mensaje original.');
    setResultadoPegado({ reconocidos, conservados, revisar, arvConMas, advertencias });
  };

  const procesarPropiedad = async (event: FormEvent) => {
    event.preventDefault();
    setGenerando(true);
    limpiarError();

    try {
      const ficha = {
        direccion_privada: direccionPrivada,
        ciudad_zona: ciudadZona,
        precio,
        arv,
        beds,
        baths,
        sqft,
        lot_size: lotSize,
        year_built: yearBuilt,
        drive_url: driveUrl,
        imagen_portada: imagenPortada,
        fotos_drive_ids: fotosDrive.map(({ id }) => id),
        portada_drive_id: portadaDrive,
        notas_extra: notasExtra,
      };
      await solicitar(userId, editando ? '/api/admin/propiedades' : '/api/procesar-propiedad', {
        method: editando ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editando
          ? { id: editando, ficha_version: borrador?.ficha_version ?? 0, accion: 'guardar_borrador', ficha }
          : { ...ficha, generar_anuncios: false }),
      });
      alGuardar(!editando);
    } catch (error) {
      mostrarError(error, 'No se pudo procesar la propiedad');
    } finally {
      setGenerando(false);
    }
  };

  return (
    <form
      id="formulario-ficha" data-admin-seccion
      onSubmit={procesarPropiedad}
      className="inventario-ficha space-y-4 rounded-2xl border border-[var(--admin-soft)] bg-[var(--admin-surface)] p-4 sm:p-5"
    >
      <h2 className="font-semibold text-[var(--admin-accent)] flex items-center gap-2">
        <Sparkles size={18} /> {editando ? 'Editar borrador' : 'Nueva propiedad'}
      </h2>

      <div className="space-y-2">
        <label htmlFor="bloque-datos" className="block text-sm font-medium">
          Pegar datos de la propiedad
        </label>
        <textarea
          id="bloque-datos"
          rows={10}
          value={bloqueDatos}
          onChange={(event) => {
            setBloqueDatos(event.target.value);
            setResultadoPegado(null);
          }}
          placeholder={'7824 W Pierson St, Phoenix, AZ 85033\nPICTURES\nhttps://drive.google.com/drive/folders/...\nPrice: $295,000\nPrecio del Mercado: $395,000+\nBeds: 4\nBaths: 2'}
          className="w-full rounded-lg border border-[var(--admin-soft)] bg-[var(--admin-canvas)] px-3 py-2 text-sm"
        />
        <p className="text-sm text-[var(--admin-secondary)]">Pega un mensaje por propiedad. Reconoce dirección, ciudad, ZIP, carpeta y datos numéricos; conserva los detalles adicionales en notas privadas.</p>
        <button
          type="button"
          onClick={aplicarDatosPegados}
          disabled={!bloqueDatos.trim() || generando}
          className="rounded-lg bg-[var(--admin-soft)] px-3 py-2 text-sm font-medium disabled:opacity-50"
        >
          Rellenar campos vacíos
        </button>
        {resultadoPegado && (
          <div role="status" className="space-y-1 text-sm text-[var(--admin-body)]">
            <p>{resultadoPegado.reconocidos.length
              ? `Reconocidos: ${resultadoPegado.reconocidos.map((campo) => camposPegables[campo][0]).join(', ')}.`
              : 'No se reconocieron valores. Usa una etiqueta y un valor por línea o completa el formulario.'}</p>
            {camposFaltantes.length > 0 && (
              <p>Sin completar: {camposFaltantes.map((campo) => camposPegables[campo][0]).join(', ')}.</p>
            )}
            {resultadoPegado.revisar.length > 0 && (
              <p>Revisa los valores incompletos o ambiguos de {resultadoPegado.revisar.map((campo) => camposPegables[campo][0]).join(', ')}.</p>
            )}
            {resultadoPegado.conservados.length > 0 && (
              <p>Se conservaron los valores del formulario para {resultadoPegado.conservados.map((campo) => camposPegables[campo][0]).join(', ')}.</p>
            )}
            {resultadoPegado.arvConMas && <p>El Precio del Mercado del bloque llevaba «+». Revisa el importe antes de guardar.</p>}
            {resultadoPegado.advertencias.map((aviso) => <p key={aviso}>{aviso}</p>)}
            <p>Corrige los datos abajo. Puedes guardar el borrador aunque falten campos.</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="grid content-start gap-1 text-sm">
          Dirección exacta (privada)
          <input
            type="text"
            placeholder="Ej. 4512 W McDowell Rd"
            value={direccionPrivada}
            onChange={(e) => setDireccionPrivada(e.target.value)}
            className="bg-[var(--admin-canvas)] border border-[var(--admin-soft)] rounded-lg px-3 py-2 text-sm"
          />
        </label>
        <div className="grid items-start gap-3 sm:grid-cols-2">
          <SelectorCiudad value={ciudad} onChange={(valor) => {
            setCiudad(valor);
            setZonaOriginal(unirUbicacion(valor, zip));
          }} />
          <label className="grid gap-1 text-sm">ZIP público
            <input className="vip-input" inputMode="numeric" maxLength={5} value={zip}
              onChange={(e) => {
                const nuevoZip = e.target.value.replace(/\D/g, '').slice(0, 5);
                setZip(nuevoZip);
                setZonaOriginal(unirUbicacion(ciudad, nuevoZip));
              }} />
          </label>
          {ciudadZona && !ciudad && <p className="text-sm sm:col-span-2">Revisa la ubicación reconocida: {ciudadZona}. Selecciona su ciudad antes de publicar.</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <label className="grid content-start gap-1 text-sm">
          Precio (USD)
          <input
            type="number" min="0"
            step="0.01"
            value={precio}
            onChange={(e) => setPrecio(e.target.value)}
            className="bg-[var(--admin-canvas)] border border-[var(--admin-soft)] rounded-lg px-3 py-2 text-sm"
          />
        </label>
        <label className="grid content-start gap-1 text-sm">
          Precio del Mercado (USD)
          <input
            type="number" min="0"
            step="0.01"
            value={arv}
            onChange={(e) => setArv(e.target.value)}
            className="bg-[var(--admin-canvas)] border border-[var(--admin-soft)] rounded-lg px-3 py-2 text-sm"
          />
        </label>
        <label className="grid content-start gap-1 text-sm">
          Recámaras
          <input
            type="number" {...limitesEnterosFicha.recamaras} step="1"
            value={beds}
            onChange={(e) => setBeds(e.target.value)}
            className="bg-[var(--admin-canvas)] border border-[var(--admin-soft)] rounded-lg px-3 py-2 text-sm"
          />
        </label>
        <label className="grid content-start gap-1 text-sm">
          Baños
          <input
            type="number" min="0"
            step="any"
            value={baths}
            onChange={(e) => setBaths(e.target.value)}
            className="bg-[var(--admin-canvas)] border border-[var(--admin-soft)] rounded-lg px-3 py-2 text-sm"
          />
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="grid content-start gap-1 text-sm">
          Superficie (sqft)
          <input
            type="number" min="0" step="any"
            value={sqft}
            onChange={(e) => setSqft(e.target.value)}
            className="bg-[var(--admin-canvas)] border border-[var(--admin-soft)] rounded-lg px-3 py-2 text-sm"
          />
        </label>
        <label className="grid content-start gap-1 text-sm">
          Tamaño del lote
          <input
            type="text"
            placeholder="Ej. 6,500 sqft"
            value={lotSize}
            onChange={(e) => setLotSize(e.target.value)}
            className="bg-[var(--admin-canvas)] border border-[var(--admin-soft)] rounded-lg px-3 py-2 text-sm"
          />
        </label>
        <label className="grid content-start gap-1 text-sm">
          Año de construcción
          <input
            type="number" {...limitesEnterosFicha.anioConstruccion} step="1"
            value={yearBuilt}
            onChange={(e) => setYearBuilt(e.target.value)}
            className="bg-[var(--admin-canvas)] border border-[var(--admin-soft)] rounded-lg px-3 py-2 text-sm"
          />
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="grid content-start gap-1 text-sm">
          Enlace de Google Drive
          <input
            type="url"
            value={driveUrl}
            onChange={(e) => {
              const enlace = e.target.value;
              if (enlace.trim() !== driveUrl.trim()) {
                setFotosDrive([]);
                setPortadaDrive(null);
              }
              setDriveUrl(enlace);
            }}
            className="bg-[var(--admin-canvas)] border border-[var(--admin-soft)] rounded-lg px-3 py-2 text-sm"
          />
        </label>
        <label className="grid content-start gap-1 text-sm">
          URL de portada alternativa
          <input
            type="url"
            disabled={portadaDrive !== null}
            value={imagenPortada}
            onChange={(e) => setImagenPortada(e.target.value)}
            className="bg-[var(--admin-canvas)] border border-[var(--admin-soft)] rounded-lg px-3 py-2 text-sm"
          />
        </label>
      </div>

      {driveUrl.trim() && (
        <SelectorFotosDrive
          key={`${editando ?? 'nueva'}:${driveUrl.trim()}`}
          carpeta={driveUrl.trim()}
          nombrePropiedad={direccionPrivada.trim() || ciudadZona}
          seleccionadas={fotosDrive}
          portada={portadaDrive}
          alSeleccionar={(fotos) => {
            setFotosDrive(fotos);
            if (!fotos.some(({ id }) => id === portadaDrive)) setPortadaDrive(null);
          }}
          alElegirPortada={(foto) => {
            setPortadaDrive(foto.id);
            setImagenPortada('');
            setFotosDrive((seleccion) => seleccion.some(({ id }) => id === foto.id)
              ? seleccion : [...seleccion, foto]);
          }}
          listar={listarFotos}
          abrir={abrirFoto}
          abrirOriginal={abrirOriginal}
        />
      )}

      <label className="grid content-start gap-1 text-sm">
        Notas extra o condiciones
        <textarea
          rows={2}
          placeholder="Notas privadas del mensaje: ocupación, acceso, reparaciones, enganche por confirmar…"
          value={notasExtra}
          onChange={(e) => setNotasExtra(e.target.value)}
          className="w-full bg-[var(--admin-canvas)] border border-[var(--admin-soft)] rounded-lg px-3 py-2 text-sm"
        />
      </label>

      <p className="text-sm text-[var(--admin-secondary)]">Estas notas son privadas y no confirman automáticamente características ni condiciones para los anuncios.</p>

      <button
        type="submit"
        disabled={generando}
        className="bg-[var(--admin-primary)] hover:bg-[var(--admin-accent)] disabled:opacity-50 text-[var(--admin-canvas)] font-semibold px-5 py-2.5 rounded-lg flex items-center gap-2 transition cursor-pointer"
      >
        <Sparkles size={18} />
        {generando ? 'Guardando…' : 'Guardar borrador'}
      </button>
      {editando && (
        <button type="button" onClick={cancelar} disabled={generando} className="public-action">
          Cancelar edición
        </button>
      )}
    </form>
  );
}
