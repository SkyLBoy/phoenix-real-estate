'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { paisesWhatsApp, type PaisWhatsApp, type PerfilVip } from '@/lib/compradores-vip';
import { etiquetaDisponibilidad } from '@/lib/disponibilidad';
import { useRelojDisponibilidad } from '@/lib/use-reloj-disponibilidad';
import { supabase } from '@/lib/supabase';
import { CAMPOS_PUBLICOS, enlacePortada, enlaceWhatsApp, type PropiedadPublica } from '@/lib/propiedades-publicas';
import {
  MapPin,
  BedDouble,
  Bath,
  Maximize,
  FolderOpen,
  MessageCircle,
  CheckCircle2,
  House,
  Search,
} from 'lucide-react';

export default function CatalogoPublico() {
  const ahora = useRelojDisponibilidad();
  const [propiedades, setPropiedades] = useState<PropiedadPublica[]>([]);
  const [filtroZona, setFiltroZona] = useState('');
  const [cargando, setCargando] = useState(true);

  // Formulario de registro VIP
  const [nombre, setNombre] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [pais, setPais] = useState<PaisWhatsApp | ''>('');
  const [perfil, setPerfil] = useState<PerfilVip>('familia_vivienda');
  const [tieneItin, setTieneItin] = useState(false);
  const [leadEnviado, setLeadEnviado] = useState(false);
  const [enviandoLead, setEnviandoLead] = useState(false);
  const [errorLead, setErrorLead] = useState('');

  useEffect(() => {
    const cargar = async () => {
      const { data } = await supabase
        .from('propiedades_publicas')
        .select(CAMPOS_PUBLICOS)
        .eq('estado', 'disponible')
        .order('created_at', { ascending: false });

      if (data) setPropiedades(data);
      setCargando(false);
    };
    cargar();
  }, []);

  const registrarLead = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviandoLead(true);
    setErrorLead('');
    try {
      const respuesta = await fetch('/api/compradores-vip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, whatsapp, pais, perfil, tiene_itin: tieneItin }),
      });
      if (!respuesta.ok) {
        const detalle = await respuesta.json().catch(() => null);
        throw new Error(detalle?.error || 'No se pudo guardar el registro.');
      }
      setLeadEnviado(true);
    } catch (fallo) {
      setErrorLead(fallo instanceof Error ? fallo.message : 'No se pudo guardar el registro.');
    } finally {
      setEnviandoLead(false);
    }
  };

  const filtradas = propiedades.filter((p) =>
    p.ciudad_zona.toLowerCase().includes(filtroZona.trim().toLowerCase())
  );

  return (
    <main className="public-shell">
      <header className="brand-bar">
        <div className="public-wrap flex flex-wrap items-center justify-between gap-x-4">
          <Link href="/" className="brand-lockup" aria-label="Sergio Orantes | House FixAndFlip">
            <span className="brand-mark"><House size={20} aria-hidden="true" /></span>
            <span><strong>Sergio Orantes</strong><small>House FixAndFlip</small></span>
          </Link>
          <a href="#lista-vip" className="inline-flex min-h-11 items-center text-sm font-semibold text-white">Lista VIP</a>
        </div>
      </header>

      <section className="catalog-hero">
        <div className="public-wrap grid gap-7 py-10 md:grid-cols-[1.45fr_1fr] md:items-end md:py-16">
          <h1 className="catalog-title">Casas disponibles en Arizona</h1>
          <div className="space-y-4">
            <p className="max-w-sm leading-relaxed text-[var(--muted)]">
              Explora propiedades para vivir o invertir y coordina una visita por WhatsApp.
            </p>
            <label className="catalog-search">
              <Search size={19} className="shrink-0 text-[var(--blue)]" aria-hidden="true" />
              <input type="search" aria-label="Filtrar por ciudad o código postal" placeholder="Ciudad o código postal"
                value={filtroZona} onChange={(e) => setFiltroZona(e.target.value)} />
            </label>
          </div>
        </div>
      </section>

      <section aria-labelledby="inventario-publico" className="public-wrap py-8 md:py-11">
        <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-3 border-b border-[var(--line)] pb-3">
          <h2 id="inventario-publico" className="text-xl font-semibold tracking-tight">Propiedades</h2>
          {!cargando && <p className="text-sm text-[var(--muted)]">{filtradas.length} {filtradas.length === 1 ? 'resultado' : 'resultados'}</p>}
        </div>
        {cargando ? (
          <p className="public-panel text-center text-[var(--muted)] px-4 py-12">Cargando inventario...</p>
        ) : filtradas.length === 0 ? (
          <p className="public-panel text-center text-[var(--muted)] px-4 py-12">
            No hay propiedades que coincidan con tu búsqueda en este momento.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {filtradas.map((prop) => {
              const portada = enlacePortada(prop);
              const porConfirmar = etiquetaDisponibilidad(prop.estado, prop.ultima_confirmacion, ahora) === 'Por confirmar';
              return (
                <article
                  key={prop.id}
                  className="property-card flex flex-col justify-between"
                >
                  <div>
                    <div className="listing-photo relative">
                      {portada ? (
                        // Drive sirve la imagen desde la URL de portada existente.
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={portada}
                          loading="lazy"
                          alt={prop.ciudad_zona}

                        />
                      ) : (
                        <span className="text-sm text-[var(--muted)]">
                          Fotos disponibles en carpeta Drive
                        </span>
                      )}
                      <span className={`status-pill absolute top-3 right-3 ${porConfirmar ? 'status-pending' : ''}`}>
                        {porConfirmar ? 'Por confirmar' : 'Disponible'}
                      </span>
                    </div>

                    <div className="space-y-4 px-5 pt-5 pb-4">
                      <div className="flex items-center gap-1.5 text-sm font-semibold text-[var(--muted)]">
                        <MapPin size={14} /> {prop.ciudad_zona}
                      </div>

                      <div>
                        <p className="listing-price">
                          ${Number(prop.precio).toLocaleString()}{' '}
                          <span className="text-xs font-medium tracking-normal text-[var(--muted)]">USD</span>
                        </p>
                        {prop.arv && (
                          <p className="listing-arv mt-1 text-sm font-semibold">
                            ARV Estimado: ${Number(prop.arv).toLocaleString()}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[var(--line)] pt-3 text-sm text-[var(--muted)]">
                        {prop.beds && (
                          <span className="flex items-center gap-1">
                            <BedDouble size={14} className="text-[var(--blue)]" /> {prop.beds} Rec
                          </span>
                        )}
                        {prop.baths && (
                          <span className="flex items-center gap-1">
                            <Bath size={14} className="text-[var(--blue)]" /> {prop.baths} Baños
                          </span>
                        )}
                        {prop.sqft && (
                          <span className="flex items-center gap-1">
                            <Maximize size={14} className="text-[var(--blue)]" /> {prop.sqft} sqft
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-2 px-5 pb-5">
                    <Link href={`/propiedades/${prop.id}`} className="public-action">
                      Ver ficha
                    </Link>
                    {prop.drive_url && (
                      <a
                        href={prop.drive_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="public-action"
                      >
                        <FolderOpen size={15} /> Ver Fotos y Videos (Drive)
                      </a>
                    )}
                    <a
                      href={enlaceWhatsApp(prop)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="public-action public-action-primary"
                    >
                      <MessageCircle size={15} /> Pedir Dirección y Cita
                    </a>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Captura de Compradores VIP (independiente de Facebook) */}
      <section id="lista-vip" className="public-wrap scroll-mt-5 pb-12 md:pb-16">
        <div className="public-panel max-w-2xl space-y-4 p-5 md:p-7">
          <h2 className="text-xl font-bold">
            Lista prioritaria de compradores
          </h2>
          <p className="text-sm text-[var(--muted)]">
            Registro opcional. Al inscribirte, aceptas que el vendedor te contacte por WhatsApp con oportunidades inmobiliarias.
          </p>

          {leadEnviado ? (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800">
              <CheckCircle2 size={18} /> ¡Listo! Ya quedaste registrado en nuestra lista
              prioritaria.
            </div>
          ) : (
            <form onSubmit={registrarLead} className="space-y-3">
              <input
                type="text"
                aria-label="Tu nombre completo"
                autoComplete="name"
                maxLength={120}
                placeholder="Tu nombre completo"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
                className="vip-input"
              />
              <div className="grid gap-2 sm:grid-cols-[auto_1fr]">
                <select aria-label="País del número de WhatsApp" required value={pais}
                  onChange={(event) => setPais(event.target.value as PaisWhatsApp | '')}
                  className="vip-input">
                  <option value="" disabled>País y lada</option>
                  {Object.entries(paisesWhatsApp).map(([codigo, { etiqueta }]) => (
                    <option key={codigo} value={codigo}>{etiqueta}</option>
                  ))}
                </select>
                <input type="tel" aria-label="Tu número de WhatsApp" autoComplete="tel-national"
                  maxLength={40} placeholder="Número de 10 dígitos" value={whatsapp} required
                  onChange={(event) => setWhatsapp(event.target.value)}
                  className="vip-input" />
              </div>
              <select
                aria-label="Perfil de comprador"
                value={perfil}
                onChange={(e) =>
                  setPerfil(e.target.value as PerfilVip)
                }
                className="vip-input"
              >
                <option value="familia_vivienda">Busco casa para vivir (ITIN / Enganche)</option>
                <option value="inversionista">Soy inversionista (Cash / Fix & Flip)</option>
              </select>
              <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-[var(--muted)]">
                <input
                  type="checkbox"
                  checked={tieneItin}
                  onChange={(e) => setTieneItin(e.target.checked)}
                  className="size-5 shrink-0 accent-[var(--blue)]"
                />
                Cuento con ITIN / Pasaporte o enganche listo
              </label>
              {errorLead && <p role="alert" className="text-sm text-red-700">{errorLead}</p>}
              <button
                type="submit"
                disabled={enviandoLead}
                className="public-action public-action-primary w-full"
              >
                {enviandoLead ? 'Guardando…' : 'Unirme a la Lista Prioritaria'}
              </button>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}