'use client';

import { separarUbicacion, unirUbicacion } from '@/lib/ciudades-phoenix';

import { LogoMarca } from '../logo-marca';
import { SelectorCiudad } from '../selector-ciudad';
import { FichaInventario } from './ficha-inventario';
import { type MaterialRevisado } from './revision-material';
import { useCallback, useEffect, useState } from 'react';
import { respuestaPrivada, solicitar } from '@/lib/api-admin';
import type { FotoDrivePanel as FotoDrive } from '@/lib/fotos-drive';
import { type EstadoDisponibilidad } from '@/lib/disponibilidad';
import { ColaDisponibilidad, type PaginaPendientes } from './cola-disponibilidad';
import { useRelojDisponibilidad } from '@/lib/use-reloj-disponibilidad';
import { CasasOfrecidas } from './casas-ofrecidas';
import { CompradoresVip } from './compradores-vip';
import { AvisoWhatsApp } from './aviso-whatsapp';
import { SelectorFotosDrive } from './fotos-drive';
import { camposPegables, leerDatosPegados, type CampoPegable } from './datos-pegados';
import {
  Sparkles,
  ExternalLink,
  Building2,
} from 'lucide-react';

import type { Propiedad } from '@/lib/propiedad-admin';

export function Inventario({
  userId,
  cerrarSesion,
  saliendo,
  errorSesion,
}: {
  userId: string;
  cerrarSesion: () => Promise<void>;
  saliendo: boolean;
  errorSesion: string;
}) {
  const ahora = useRelojDisponibilidad();
  const [cambiosDisponibilidad, setCambiosDisponibilidad] = useState<Set<string>>(() => new Set());
  const [propiedades, setPropiedades] = useState<Propiedad[] | null>(null);
  const [accesoDenegado, setAccesoDenegado] = useState(false);
  const [errorOperacion, setErrorOperacion] = useState('');
  const [generando, setGenerando] = useState(false);

  // Campos del formulario
  const [direccionPrivada, setDireccionPrivada] = useState('');
  const [ciudadZona, setZonaOriginal] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [zip, setZip] = useState('');
  const setCiudadZona = (zona: string) => {
    const ubicacion = separarUbicacion(zona);
    setZonaOriginal(zona);
    setCiudad(ubicacion.ciudad);
    setZip(ubicacion.zip);
  };
  const [precio, setPrecio] = useState('');
  const [arv, setArv] = useState('');
  const [beds, setBeds] = useState('');
  const [baths, setBaths] = useState('');
  const [sqft, setSqft] = useState('');
  const [lotSize, setLotSize] = useState('');
  const [yearBuilt, setYearBuilt] = useState('');
  const [driveUrl, setDriveUrl] = useState('');
  const [imagenPortada, setImagenPortada] = useState('');
  const [fotosDrive, setFotosDrive] = useState<FotoDrive[]>([]);
  const [portadaDrive, setPortadaDrive] = useState<string | null>(null);

  const listarFotos = async (carpeta: string) => {
    const params = new URLSearchParams({ carpeta });
    const { fotos } = await solicitar<{ fotos: FotoDrive[] }>(userId, `/api/admin/drive?${params}`);
    return fotos;
  };

  const abrirFoto = useCallback(async (foto: FotoDrive, signal?: AbortSignal) => {
    const params = new URLSearchParams({ foto: foto.id });
    if (foto.resourceKey) params.set('clave', foto.resourceKey);
    return (await respuestaPrivada(userId, `/api/admin/drive?${params}`, { signal })).blob();
  }, [userId]);
  const abrirOriginal = async (foto: FotoDrive, modo: 'original' | 'vista' = 'original') => {
    const params = new URLSearchParams({ foto: foto.id, [modo === 'vista' ? 'vista' : 'original']: '1' });
    if (foto.resourceKey) params.set('clave', foto.resourceKey);
    return (await respuestaPrivada(userId, `/api/admin/drive?${params}`)).blob();
  };
  const [notasExtra, setNotasExtra] = useState('');
  const [versionEdicion, setVersionEdicion] = useState(0);
  const [editando, setEditando] = useState<string | null>(null);
  const [revisando, setRevisando] = useState<string | null>(null);
  const [publicando, setPublicando] = useState(false);
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

  const cargarFormulario = (prop?: Propiedad) => {
    setEditando(prop?.id ?? null);
    setVersionEdicion(prop?.ficha_version ?? 0);
    setBloqueDatos('');
    setResultadoPegado(null);
    setDireccionPrivada(prop?.direccion_privada ?? '');
    setCiudadZona(prop?.ciudad_zona ?? '');
    setPrecio(String(prop?.precio ?? ''));
    setArv(String(prop?.arv ?? ''));
    setBeds(String(prop?.beds ?? ''));
    setBaths(String(prop?.baths ?? ''));
    setSqft(String(prop?.sqft ?? ''));
    setLotSize(prop?.lot_size ?? '');
    setYearBuilt(String(prop?.year_built ?? ''));
    setDriveUrl(prop?.drive_url ?? '');
    setImagenPortada(prop?.imagen_portada ?? '');
    setFotosDrive(prop?.fotos_drive ?? []);
    setPortadaDrive(prop?.portada_drive_id ?? null);
    setNotasExtra(prop?.notas_extra ?? '');
  };

  const mostrarError = useCallback((error: unknown, mensaje: string) => {
    if (error instanceof Error && (error.cause === 401 || error.cause === 403)) {
      setAccesoDenegado(true);
    }
    setErrorOperacion(error instanceof Error ? error.message : mensaje);
  }, []);

  const [intentoCarga, setIntentoCarga] = useState(0);
  const [revisionAviso, setRevisionAviso] = useState(0);
  const [paginaInventario, setPaginaInventario] = useState(0);
  const [hayMasInventario, setHayMasInventario] = useState(false);
  const [paginaCargada, setPaginaCargada] = useState(0);
  const cargarPendientes = useCallback((pagina: number, signal: AbortSignal) =>
    solicitar<PaginaPendientes>(userId, `/api/admin/propiedades?vista=por_confirmar&pagina=${pagina}`, { signal }), [userId]);

  useEffect(() => {
    const controller = new AbortController();
    solicitar<{ propiedades: Propiedad[]; hayMas: boolean }>(userId, `/api/admin/propiedades?pagina=${paginaInventario}`, {
      signal: controller.signal,
    })
      .then(({ propiedades, hayMas }) => {
        if (controller.signal.aborted) return;
        if (!propiedades.length && paginaInventario > 0) {
          setPaginaInventario(paginaInventario - 1);
          return;
        }
        setPropiedades(propiedades);
        setHayMasInventario(hayMas);
        setPaginaCargada(paginaInventario);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) mostrarError(error, 'No se pudo cargar el inventario');
      });
    return () => controller.abort();
  }, [intentoCarga, mostrarError, userId, paginaInventario]);

  const procesarPropiedad = async (event: React.FormEvent) => {
    event.preventDefault();
    setGenerando(true);
    setErrorOperacion('');

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
          ? { id: editando, ficha_version: versionEdicion, accion: 'guardar_borrador', ficha }
          : { ...ficha, generar_anuncios: false }),
      });
      if (!editando) setPaginaInventario(0);
      setIntentoCarga((intento) => intento + 1);
      cargarFormulario();
    } catch (error) {
      mostrarError(error, 'No se pudo procesar la propiedad');
    } finally {
      setGenerando(false);
    }
  };

  const publicar = async (prop: Propiedad, material: MaterialRevisado) => {
    setPublicando(true);
    setErrorOperacion('');
    try {
      await solicitar(userId, '/api/admin/propiedades', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: prop.id,
          accion: prop.publicada_en ? 'actualizar_material' : 'publicar',
          ...material,
          ficha_version: prop.ficha_version,
          zona_revisada: prop.ciudad_zona,
          portada_revisada: prop.imagen_portada,
          portada_drive_revisada: prop.portada_drive_id,
          carpeta_revisada: prop.drive_url,
        }),
      });
      setRevisando(null);
      setRevisionAviso((revision) => revision + 1);
      setIntentoCarga((intento) => intento + 1);
    } catch (error) {
      mostrarError(error, 'No se pudo publicar');
    } finally {
      setPublicando(false);
    }
  };

  const cambiarEstado = async (id: string, estado: EstadoDisponibilidad) => {
    setErrorOperacion('');
    setCambiosDisponibilidad((actuales) => new Set(actuales).add(id));
    try {
      const { disponibilidad } = await solicitar<{
        disponibilidad: Pick<Propiedad, 'estado' | 'ultima_confirmacion' | 'ficha_version'>;
      }>(userId, '/api/admin/propiedades', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, estado }),
      });
      setPropiedades((actuales) => actuales?.map((prop) => prop.id === id
        ? { ...prop, ...disponibilidad } : prop) ?? null);
      setRevisionAviso((revision) => revision + 1);
    } catch (error) {
      mostrarError(error, 'No se pudo cambiar el estado');
    } finally {
      setCambiosDisponibilidad((actuales) => {
        const pendientes = new Set(actuales);
        pendientes.delete(id);
        return pendientes;
      });
    }
  };

  const eliminarPropiedad = async (id: string) => {
    if (!confirm('¿Eliminar esta propiedad permanentemente?')) return;
    setErrorOperacion('');
    try {
      await solicitar(userId, `/api/admin/propiedades?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      setRevisionAviso((revision) => revision + 1);
      setIntentoCarga((intento) => intento + 1);
    } catch (error) {
      mostrarError(error, 'No se pudo eliminar la propiedad');
    }
  };


  const botonCerrarSesion = (
    <button
      type="button"
      onClick={cerrarSesion}
      disabled={saliendo}
      className="text-sm bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 px-3 py-2 rounded-lg cursor-pointer"
    >
      {saliendo ? 'Cerrando sesión…' : 'Cerrar sesión'}
    </button>
  );

  if (accesoDenegado || propiedades === null) {
    return (
      <main className="admin-shell min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center gap-4 p-4">
        {errorOperacion ? (
          <p role="alert" className="text-sm text-red-300">{errorOperacion}</p>
        ) : (
          <p role="status">Comprobando acceso al inventario…</p>
        )}
        {errorOperacion && !accesoDenegado && (
          <button
            type="button"
            className="text-sm bg-zinc-800 hover:bg-zinc-700 px-3 py-2 rounded-lg cursor-pointer"
            onClick={() => {
              setErrorOperacion('');
              setIntentoCarga((intento) => intento + 1);
            }}
          >
            Reintentar
          </button>
        )}
        {botonCerrarSesion}
        {errorSesion && <p role="alert" className="text-sm text-red-300">{errorSesion}</p>}
      </main>
    );
  }

  return (
    <main className="admin-shell min-h-screen bg-zinc-950 text-zinc-100 p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-5 md:space-y-7">
        <header className="admin-header flex flex-wrap items-center justify-between gap-5 p-5 md:p-7">
          <div>
            <div className="flex items-center gap-3"><LogoMarca /><p className="admin-brand">Sergio Orantes | House FixAndFlip</p></div>
            <h1 className="editorial-title mt-1 flex items-center gap-2 text-3xl md:text-4xl">
              <Building2 className="shrink-0 text-white" /> Panel de propiedades
            </h1>
            <p className="admin-subtitle mt-2 text-sm">
              Guarda borradores, revisa la portada y publica en el catálogo.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href="/"
              target="_blank"
              className="text-sm bg-zinc-800 hover:bg-zinc-700 px-3 py-2 rounded-lg flex items-center gap-1.5"
            >
              Ver Catálogo Público <ExternalLink size={14} />
            </a>
            {botonCerrarSesion}
          </div>
        </header>

        {(errorSesion || errorOperacion) && (
          <p role="alert" className="text-sm text-red-300">{errorSesion || errorOperacion}</p>
        )}

        <nav className="admin-nav" aria-label="Secciones del panel">
          <a href="#inventario-admin">Inventario</a>
          <a href="#formulario-ficha">Nueva ficha</a>
          <a href="#aviso-admin">Aviso diario</a>
          <a href="#vip-admin">Compradores VIP</a>
          <a href="#casas-ofrecidas-admin">Casas ofrecidas</a>
        </nav>

        <div id="aviso-admin" data-admin-seccion>
          <AvisoWhatsApp key={revisionAviso} ahora={ahora} />
        </div>

        <div id="vip-admin" data-admin-seccion>
          <CompradoresVip cargar={(pagina) => solicitar(userId, `/api/admin/compradores-vip?pagina=${pagina}`)} />
        </div>

        <div id="casas-ofrecidas-admin" data-admin-seccion>
          <CasasOfrecidas solicitar={(opciones, pagina = 0) =>
            solicitar(userId, `/api/admin/casas-ofrecidas?pagina=${pagina}`, opciones)} />
        </div>

        {/* Formulario de Ingesta */}
        <form
          id="formulario-ficha" data-admin-seccion
          onSubmit={procesarPropiedad}
          className="inventario-ficha space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-4 sm:p-5"
        >
          <h2 className="font-semibold text-amber-400 flex items-center gap-2">
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
              placeholder={'7824 W Pierson St, Phoenix, AZ 85033\nPICTURES\nhttps://drive.google.com/drive/folders/...\nPrice: $295,000\nARV: $395,000+\nBeds: 4\nBaths: 2'}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
            />
            <p className="text-sm text-zinc-400">Pega un mensaje por propiedad. Reconoce dirección, ciudad, ZIP, carpeta y datos numéricos; conserva los detalles adicionales en notas privadas.</p>
            <button
              type="button"
              onClick={aplicarDatosPegados}
              disabled={!bloqueDatos.trim() || generando}
              className="rounded-lg bg-zinc-800 px-3 py-2 text-sm font-medium disabled:opacity-50"
            >
              Rellenar campos vacíos
            </button>
            {resultadoPegado && (
              <div role="status" className="space-y-1 text-sm text-zinc-300">
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
                {resultadoPegado.arvConMas && <p>El ARV del bloque llevaba «+». Revisa el importe antes de guardar.</p>}
                {resultadoPegado.advertencias.map((aviso) => <p key={aviso}>{aviso}</p>)}
                <p>Corrige los datos abajo. Puedes guardar el borrador aunque falten campos.</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              type="text"
              aria-label="Dirección exacta"
              placeholder="Dirección exacta (PRIVADA - Ej: 4512 W McDowell Rd)"
              value={direccionPrivada}
              onChange={(e) => setDireccionPrivada(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm"
            />
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
            <input
              type="number"
              step="0.01"
              aria-label="Precio"
              placeholder="Precio ($ USD)"
              value={precio}
              onChange={(e) => setPrecio(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm"
            />
            <input
              type="number"
              step="0.01"
              aria-label="ARV"
              placeholder="ARV ($ opcional)"
              value={arv}
              onChange={(e) => setArv(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm"
            />
            <input
              type="number"
              aria-label="Recámaras"
              placeholder="Recámaras (Beds)"
              value={beds}
              onChange={(e) => setBeds(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm"
            />
            <input
              type="number"
              step="any"
              aria-label="Baños"
              placeholder="Baños (Baths)"
              value={baths}
              onChange={(e) => setBaths(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="number"
              aria-label="Sqft"
              placeholder="Sqft"
              value={sqft}
              onChange={(e) => setSqft(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm"
            />
            <input
              type="text"
              aria-label="Lot Size"
              placeholder="Lot Size (Ej: 6,500 sqft)"
              value={lotSize}
              onChange={(e) => setLotSize(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm"
            />
            <input
              type="number"
              aria-label="Año construcción"
              placeholder="Año construcción"
              value={yearBuilt}
              onChange={(e) => setYearBuilt(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              type="url"
              aria-label="Link de Google Drive"
              placeholder="Link de Google Drive (fotos/videos)"
              value={driveUrl}
              onChange={(e) => {
                const enlace = e.target.value;
                if (enlace.trim() !== driveUrl.trim()) {
                  setFotosDrive([]);
                  setPortadaDrive(null);
                }
                setDriveUrl(enlace);
              }}
              className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm"
            />
            <input
              type="url"
              aria-label="URL de portada alternativa"
              placeholder="URL de portada alternativa"
              disabled={portadaDrive !== null}
              value={imagenPortada}
              onChange={(e) => setImagenPortada(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm"
            />
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

          <textarea
            rows={2}
            aria-label="Notas extra o condiciones"
            placeholder="Notas privadas del mensaje: ocupación, acceso, reparaciones, enganche por confirmar…"
            value={notasExtra}
            onChange={(e) => setNotasExtra(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm"
          />

          <p className="text-sm text-zinc-400">Estas notas son privadas y no confirman automáticamente características ni condiciones para los anuncios.</p>

          <button
            type="submit"
            disabled={generando}
            className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 font-semibold px-5 py-2.5 rounded-lg flex items-center gap-2 transition cursor-pointer"
          >
            <Sparkles size={18} />
            {generando ? 'Guardando…' : 'Guardar borrador'}
          </button>
          {editando && (
            <button type="button" onClick={() => cargarFormulario()} disabled={generando}>
              Cancelar edición
            </button>
          )}
        </form>

        {/* Lista de Propiedades y Scripts */}
        <section id="inventario-admin" data-admin-seccion className="space-y-4">
          <h2 className="editorial-title text-2xl">
            Inventario
          </h2>
          <ColaDisponibilidad key={revisionAviso} cargar={cargarPendientes} actualizar={cambiarEstado}
            ocupadas={cambiosDisponibilidad} ahora={ahora} />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-lg font-semibold">Todas las fichas</h3>
            <button type="button" className="public-action" onClick={() => setIntentoCarga((n) => n + 1)}>Recargar inventario</button>
          </div>
          {propiedades.length === 0 && <p>Todavía no hay fichas en el inventario.</p>}

          {propiedades.map((prop) => <FichaInventario key={prop.id} prop={prop} userId={userId} ahora={ahora}
            editando={editando} revisandoFicha={revisando === prop.id} actualizando={cambiosDisponibilidad.has(prop.id)} publicando={publicando}
            setRevisando={setRevisando} cargarFormulario={cargarFormulario} eliminarPropiedad={eliminarPropiedad}
            cambiarEstado={cambiarEstado} publicar={publicar} abrirFoto={abrirFoto} abrirOriginal={abrirOriginal}
            actualizarFicha={(id, cambios, actualizarAviso) => {
              setPropiedades((actuales) => actuales?.map((ficha) => ficha.id === id ? { ...ficha, ...cambios } : ficha) ?? null);
              if (actualizarAviso) setRevisionAviso((revision) => revision + 1);
            }} />)}
          {(paginaCargada > 0 || hayMasInventario) && <nav aria-label="Páginas del inventario" className="flex items-center gap-3">
            <button type="button" className="min-h-11 rounded-lg px-3" disabled={paginaCargada === 0}
              onClick={() => { setPaginaInventario(paginaCargada - 1); setIntentoCarga((n) => n + 1); }}>Anterior</button>
            <span>Página {paginaCargada + 1}</span>
            <button type="button" className="min-h-11 rounded-lg px-3" disabled={!hayMasInventario}
              onClick={() => { setPaginaInventario(paginaCargada + 1); setIntentoCarga((n) => n + 1); }}>Siguiente</button>
          </nav>}
        </section>
      </div>
    </main>
  );
}
