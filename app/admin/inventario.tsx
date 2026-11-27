'use client';

import { LogoMarca } from '../logo-marca';
import { FichaInventario } from './ficha-inventario';
import { type MaterialRevisado } from './revision-material';
import { useCallback, useEffect, useState } from 'react';
import { solicitar } from '@/lib/api-admin';
import { type EstadoDisponibilidad } from '@/lib/disponibilidad';
import { ColaDisponibilidad, type PaginaPendientes } from './cola-disponibilidad';
import { useRelojDisponibilidad } from '@/lib/use-reloj-disponibilidad';
import { CasasOfrecidas } from './casas-ofrecidas';
import { CompradoresVip } from './compradores-vip';
import { AvisoWhatsApp } from './aviso-whatsapp';
import { FormularioFicha } from './formulario-ficha';
import { useDrivePanel } from './use-drive-panel';
import {
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
  const [formulario, setFormulario] = useState<{ revision: number; borrador?: Propiedad }>({ revision: 0 });
  const cargarFormulario = (borrador?: Propiedad) => {
    setFormulario(({ revision }) => ({ revision: revision + 1, borrador }));
  };
  const [revisando, setRevisando] = useState<string | null>(null);
  const [publicando, setPublicando] = useState(false);
  const drive = useDrivePanel(userId);

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
      className="text-sm bg-[var(--admin-soft)] hover:bg-[var(--admin-border)] disabled:opacity-50 px-3 py-2 rounded-lg cursor-pointer"
    >
      {saliendo ? 'Cerrando sesión…' : 'Cerrar sesión'}
    </button>
  );

  if (accesoDenegado || propiedades === null) {
    return (
      <main className="admin-shell min-h-screen bg-[var(--admin-canvas)] text-[var(--admin-ink)] flex flex-col items-center justify-center gap-4 p-4">
        {errorOperacion ? (
          <p role="alert" className="text-sm text-[var(--admin-danger)]">{errorOperacion}</p>
        ) : (
          <p role="status">Comprobando acceso al inventario…</p>
        )}
        {errorOperacion && !accesoDenegado && (
          <button
            type="button"
            className="text-sm bg-[var(--admin-soft)] hover:bg-[var(--admin-border)] px-3 py-2 rounded-lg cursor-pointer"
            onClick={() => {
              setErrorOperacion('');
              setIntentoCarga((intento) => intento + 1);
            }}
          >
            Reintentar
          </button>
        )}
        {botonCerrarSesion}
        {errorSesion && <p role="alert" className="text-sm text-[var(--admin-danger)]">{errorSesion}</p>}
      </main>
    );
  }

  return (
    <main className="admin-shell min-h-screen bg-[var(--admin-canvas)] text-[var(--admin-ink)] p-4 md:p-8">
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
              className="text-sm bg-[var(--admin-soft)] hover:bg-[var(--admin-border)] px-3 py-2 rounded-lg flex items-center gap-1.5"
            >
              Ver Catálogo Público <ExternalLink size={14} />
            </a>
            {botonCerrarSesion}
          </div>
        </header>

        {(errorSesion || errorOperacion) && (
          <p role="alert" className="text-sm text-[var(--admin-danger)]">{errorSesion || errorOperacion}</p>
        )}

        <nav className="admin-nav" aria-label="Secciones del panel">
          <a href="#inventario-admin">Inventario</a>
          <a href="#formulario-ficha">Nueva ficha</a>
          <a href="#aviso-admin">Aviso diario</a>
          <a href="#vip-admin">Compradores VIP</a>
          <a href="#casas-ofrecidas-admin">Casas ofrecidas</a>
        </nav>

        <div id="aviso-admin" data-admin-seccion>
          <AvisoWhatsApp revision={revisionAviso} ahora={ahora} />
        </div>

        <div id="vip-admin" data-admin-seccion>
          <CompradoresVip cargar={(pagina) => solicitar(userId, `/api/admin/compradores-vip?pagina=${pagina}`)} />
        </div>

        <div id="casas-ofrecidas-admin" data-admin-seccion>
          <CasasOfrecidas solicitar={(opciones, pagina = 0) =>
            solicitar(userId, `/api/admin/casas-ofrecidas?pagina=${pagina}`, opciones)} />
        </div>

        <FormularioFicha key={formulario.revision} userId={userId} borrador={formulario.borrador}
          drive={drive} cancelar={() => cargarFormulario()} limpiarError={() => setErrorOperacion('')}
          mostrarError={mostrarError} alGuardar={(creado) => {
            if (creado) setPaginaInventario(0);
            setIntentoCarga((intento) => intento + 1);
            setFormulario((actual) => actual === formulario ? { revision: actual.revision + 1 } : actual);
          }} />

        {/* Lista de Propiedades y Scripts */}
        <section id="inventario-admin" data-admin-seccion className="space-y-4">
          <h2 className="editorial-title text-2xl">
            Inventario
          </h2>
          <ColaDisponibilidad revision={revisionAviso} cargar={cargarPendientes} actualizar={cambiarEstado}
            ocupadas={cambiosDisponibilidad} />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-lg font-semibold">Todas las fichas</h3>
            <button type="button" className="public-action" onClick={() => setIntentoCarga((n) => n + 1)}>Recargar inventario</button>
          </div>
          {propiedades.length === 0 && <p>Todavía no hay fichas en el inventario.</p>}

          {propiedades.map((prop) => <FichaInventario key={prop.id} prop={prop} userId={userId} ahora={ahora}
            editando={formulario.borrador?.id ?? null} revisandoFicha={revisando === prop.id} actualizando={cambiosDisponibilidad.has(prop.id)} publicando={publicando}
            setRevisando={setRevisando} cargarFormulario={cargarFormulario} eliminarPropiedad={eliminarPropiedad}
            cambiarEstado={cambiarEstado} publicar={publicar} abrirFoto={drive.abrirFoto} abrirOriginal={drive.abrirOriginal}
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
