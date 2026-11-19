'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabaseAdminAuth } from '@/lib/supabase-admin-auth';
import {
  Sparkles,
  Copy,
  Check,
  Lock,
  Trash2,
  ExternalLink,
  Building2,
} from 'lucide-react';

interface Propiedad {
  id: string;
  direccion_privada: string;
  ciudad_zona: string;
  precio: number;
  arv: number | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  drive_url: string | null;
  estado: 'disponible' | 'en_contrato' | 'vendida';
  script_fb_es: string;
  script_fb_en: string;
  script_wa_vip: string;
  script_filtro_curiosos: string;
}

async function solicitar<T>(userId: string, url: string, options: RequestInit = {}): Promise<T> {
  const { data: { session } } = await supabaseAdminAuth.auth.getSession();
  if (session?.user.id !== userId) {
    throw new Error('La sesión no es válida', { cause: 401 });
  }

  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${session.access_token}`);
  const response = await fetch(url, { ...options, headers });
  if (response.ok) return response.json();

  const body = await response.json().catch(() => null);
  throw new Error(body?.error || 'No se pudo completar la operación', { cause: response.status });
}

export default function AdminPanel() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [entrando, setEntrando] = useState(false);
  const [saliendo, setSaliendo] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const { data: { subscription } } = supabaseAdminAuth.auth.onAuthStateChange(
      (_event, nextSession) => setSession(nextSession),
    );
    return () => subscription.unsubscribe();
  }, []);

  const iniciarSesion = async (event: React.FormEvent) => {
    event.preventDefault();
    setEntrando(true);
    setError('');

    try {
      const { error } = await supabaseAdminAuth.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        setError('No se pudo iniciar sesión. Revisa tu correo y contraseña.');
      } else {
        setPassword('');
      }
    } catch {
      setError('No se pudo conectar. Intenta de nuevo.');
    } finally {
      setEntrando(false);
    }
  };

  const cerrarSesion = useCallback(async () => {
    setSaliendo(true);
    setError('');
    try {
      const { error } = await supabaseAdminAuth.auth.signOut({ scope: 'local' });
      if (error) throw error;
    } catch {
      setError('No se pudo cerrar la sesión. Intenta de nuevo.');
    } finally {
      setSaliendo(false);
    }
  }, []);

  if (session === undefined) {
    return (
      <main className="min-h-screen bg-zinc-950 text-zinc-100 grid place-items-center" role="status">
        Comprobando sesión…
      </main>
    );
  }

  if (session) {
    return (
      <Inventario
        key={session.user.id}
        userId={session.user.id}
        cerrarSesion={cerrarSesion}
        saliendo={saliendo}
        errorSesion={error}
      />
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-4">
      <form
        onSubmit={iniciarSesion}
        className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl max-w-sm w-full space-y-4"
      >
        <h1 className="flex items-center gap-2 text-amber-400 font-bold text-lg">
          <Lock size={20} /> Acceso privado
        </h1>
        <label className="block space-y-1">
          <span className="text-sm">Correo electrónico</span>
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2.5 text-zinc-100 focus:outline-none focus:border-amber-400"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm">Contraseña</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2.5 text-zinc-100 focus:outline-none focus:border-amber-400"
          />
        </label>
        {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
        <button
          type="submit"
          disabled={entrando}
          className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 font-semibold py-2.5 rounded-lg transition cursor-pointer"
        >
          {entrando ? 'Iniciando sesión…' : 'Entrar al panel'}
        </button>
      </form>
    </main>
  );
}

function Inventario({
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
  const [propiedades, setPropiedades] = useState<Propiedad[] | null>(null);
  const [accesoDenegado, setAccesoDenegado] = useState(false);
  const [errorOperacion, setErrorOperacion] = useState('');
  const [generando, setGenerando] = useState(false);
  const [copiadoId, setCopiadoId] = useState<string | null>(null);

  // Campos del formulario
  const [direccionPrivada, setDireccionPrivada] = useState('');
  const [ciudadZona, setCiudadZona] = useState('');
  const [precio, setPrecio] = useState('');
  const [arv, setArv] = useState('');
  const [beds, setBeds] = useState('');
  const [baths, setBaths] = useState('');
  const [sqft, setSqft] = useState('');
  const [lotSize, setLotSize] = useState('');
  const [yearBuilt, setYearBuilt] = useState('');
  const [driveUrl, setDriveUrl] = useState('');
  const [imagenPortada, setImagenPortada] = useState('');
  const [notasExtra, setNotasExtra] = useState('');

  const mostrarError = useCallback((error: unknown, mensaje: string) => {
    if (error instanceof Error && (error.cause === 401 || error.cause === 403)) {
      setAccesoDenegado(true);
    }
    setErrorOperacion(error instanceof Error ? error.message : mensaje);
  }, []);

  const [intentoCarga, setIntentoCarga] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    solicitar<{ propiedades: Propiedad[] }>(userId, '/api/admin/propiedades', {
      signal: controller.signal,
    })
      .then(({ propiedades }) => {
        if (!controller.signal.aborted) setPropiedades(propiedades);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) mostrarError(error, 'No se pudo cargar el inventario');
      });
    return () => controller.abort();
  }, [intentoCarga, mostrarError, userId]);

  const procesarPropiedad = async (event: React.FormEvent) => {
    event.preventDefault();
    setGenerando(true);
    setErrorOperacion('');

    try {
      await solicitar(userId, '/api/procesar-propiedad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
          notas_extra: notasExtra,
        }),
      });
      setIntentoCarga((intento) => intento + 1);
      setDireccionPrivada('');
      setCiudadZona('');
      setPrecio('');
      setArv('');
      setBeds('');
      setBaths('');
      setSqft('');
      setLotSize('');
      setYearBuilt('');
      setDriveUrl('');
      setImagenPortada('');
      setNotasExtra('');
    } catch (error) {
      mostrarError(error, 'No se pudo procesar la propiedad');
    } finally {
      setGenerando(false);
    }
  };

  const cambiarEstado = async (id: string, estado: string) => {
    setErrorOperacion('');
    try {
      await solicitar(userId, '/api/admin/propiedades', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, estado }),
      });
      setIntentoCarga((intento) => intento + 1);
    } catch (error) {
      mostrarError(error, 'No se pudo cambiar el estado');
    }
  };

  const eliminarPropiedad = async (id: string) => {
    if (!confirm('¿Eliminar esta propiedad permanentemente?')) return;
    setErrorOperacion('');
    try {
      await solicitar(userId, `/api/admin/propiedades?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      setIntentoCarga((intento) => intento + 1);
    } catch (error) {
      mostrarError(error, 'No se pudo eliminar la propiedad');
    }
  };

  const copiarTexto = (clave: string, texto: string) => {
    navigator.clipboard.writeText(texto);
    setCopiadoId(clave);
    setTimeout(() => setCopiadoId(null), 2000);
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
      <main className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center gap-4 p-4">
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
    <main className="min-h-screen bg-zinc-950 text-zinc-100 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 pb-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Building2 className="text-amber-400" /> Panel de Operaciones & IA
            </h1>
            <p className="text-sm text-zinc-400">
              Carga datos crudos → Genera scripts listos y publica en el catálogo
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

        {/* Formulario de Ingesta */}
        <form
          onSubmit={procesarPropiedad}
          className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4"
        >
          <h2 className="font-semibold text-amber-400 flex items-center gap-2">
            <Sparkles size={18} /> Nueva Propiedad
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Dirección exacta (PRIVADA - Ej: 4512 W McDowell Rd)"
              value={direccionPrivada}
              onChange={(e) => setDireccionPrivada(e.target.value)}
              required
              className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm"
            />
            <input
              type="text"
              placeholder="Zona pública (Ej: Phoenix, AZ 85035)"
              value={ciudadZona}
              onChange={(e) => setCiudadZona(e.target.value)}
              required
              className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <input
              type="number"
              placeholder="Precio ($ USD)"
              value={precio}
              onChange={(e) => setPrecio(e.target.value)}
              required
              className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm"
            />
            <input
              type="number"
              placeholder="ARV ($ opcional)"
              value={arv}
              onChange={(e) => setArv(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm"
            />
            <input
              type="number"
              placeholder="Recámaras (Beds)"
              value={beds}
              onChange={(e) => setBeds(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm"
            />
            <input
              type="number"
              step="0.5"
              placeholder="Baños (Baths)"
              value={baths}
              onChange={(e) => setBaths(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="number"
              placeholder="Sqft"
              value={sqft}
              onChange={(e) => setSqft(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm"
            />
            <input
              type="text"
              placeholder="Lot Size (Ej: 6,500 sqft)"
              value={lotSize}
              onChange={(e) => setLotSize(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm"
            />
            <input
              type="number"
              placeholder="Año construcción"
              value={yearBuilt}
              onChange={(e) => setYearBuilt(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              type="url"
              placeholder="Link de Google Drive (fotos/videos)"
              value={driveUrl}
              onChange={(e) => setDriveUrl(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm"
            />
            <input
              type="url"
              placeholder="URL imagen de portada (opcional)"
              value={imagenPortada}
              onChange={(e) => setImagenPortada(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <textarea
            rows={2}
            placeholder="Notas extra o condiciones (Ej: Techo nuevo, piscina, ocupa remodelación ligera, cierre en 10 días...)"
            value={notasExtra}
            onChange={(e) => setNotasExtra(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm"
          />

          <button
            type="submit"
            disabled={generando}
            className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 font-semibold px-5 py-2.5 rounded-lg flex items-center gap-2 transition cursor-pointer"
          >
            <Sparkles size={18} />
            {generando ? 'Generando scripts con IA...' : 'Publicar y Generar Anuncios'}
          </button>
        </form>

        {/* Lista de Propiedades y Scripts */}
        <section className="space-y-6">
          <h2 className="text-lg font-semibold">
            Inventario Activo ({propiedades.length})
          </h2>

          {propiedades.map((prop) => (
            <div
              key={prop.id}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-800 pb-3">
                <div>
                  <span className="text-xs uppercase tracking-wider text-amber-400 font-semibold">
                    {prop.ciudad_zona}
                  </span>
                  <h3 className="text-lg font-bold text-zinc-100">
                    {prop.direccion_privada}{' '}
                    <span className="text-xs font-normal text-zinc-500">
                      (Solo visible aquí)
                    </span>
                  </h3>
                  <p className="text-sm text-zinc-300">
                    Precio: <strong>${Number(prop.precio).toLocaleString()}</strong>
                    {prop.arv && ` · ARV: $${Number(prop.arv).toLocaleString()}`}
                    {prop.beds && ` · ${prop.beds} bd`}
                    {prop.baths && ` / ${prop.baths} ba`}
                    {prop.sqft && ` · ${prop.sqft} sqft`}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={prop.estado}
                    onChange={(e) => cambiarEstado(prop.id, e.target.value)}
                    className="bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs"
                  >
                    <option value="disponible">Disponible</option>
                    <option value="en_contrato">En Contrato</option>
                    <option value="vendida">Vendida</option>
                  </select>
                  <button
                    onClick={() => eliminarPropiedad(prop.id)}
                    className="p-2 text-zinc-500 hover:text-red-400 cursor-pointer"
                    title="Eliminar"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* 4 Scripts listos para copiar */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  { key: 'fb_es', label: 'Facebook Español (ITIN / 15%)', text: prop.script_fb_es },
                  { key: 'fb_en', label: 'Facebook Inglés (Investors)', text: prop.script_fb_en },
                  { key: 'wa_vip', label: 'Grupo VIP WhatsApp', text: prop.script_wa_vip },
                  { key: 'filtro', label: 'Respuesta Filtro Curiosos', text: prop.script_filtro_curiosos },
                ].map((item) => {
                  const uniqueId = `${prop.id}-${item.key}`;
                  return (
                    <div
                      key={item.key}
                      className="bg-zinc-950 border border-zinc-800 rounded-xl p-3 flex flex-col justify-between gap-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-zinc-300">
                          {item.label}
                        </span>
                        <button
                          type="button"
                          onClick={() => copiarTexto(uniqueId, item.text || '')}
                          className="text-xs bg-zinc-800 hover:bg-zinc-700 px-2.5 py-1 rounded-md flex items-center gap-1 cursor-pointer"
                        >
                          {copiadoId === uniqueId ? (
                            <>
                              <Check size={13} className="text-emerald-400" /> Copiado
                            </>
                          ) : (
                            <>
                              <Copy size={13} /> Copiar
                            </>
                          )}
                        </button>
                      </div>
                      <p className="text-xs text-zinc-400 whitespace-pre-line line-clamp-5">
                        {item.text}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}