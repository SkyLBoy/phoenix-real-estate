'use client';

import { LogoMarca } from './logo-marca';
import { SelectorCiudad } from './selector-ciudad';

import { VendeTuCasa } from './vende-tu-casa';
import { GaleriaPublica } from './galeria-publica';
import { importeUsd, diferenciaArv } from './metricas-propiedad';
import { useState } from 'react';
import Link from 'next/link';
import { paisesWhatsApp, type PaisWhatsApp, type PerfilVip } from '@/lib/compradores-vip';
import { etiquetaDisponibilidad } from '@/lib/disponibilidad';
import { useRelojDisponibilidad } from '@/lib/use-reloj-disponibilidad';
import type { PaginaCatalogo } from '@/lib/catalogo';
import { useCatalogo } from '@/lib/use-catalogo';
import { enlacePortada, enlaceWhatsApp } from '@/lib/propiedades-publicas';
import {
  MapPin,
  BedDouble,
  Bath,
  Maximize,
  ArrowUpRight,
  TrendingUp,
  MessageCircle,
  CheckCircle2,
  KeyRound,
  Bell,
} from 'lucide-react';

export function CatalogoPublico({ datosIniciales, ahoraInicial }: {
  datosIniciales: PaginaCatalogo | null;
  ahoraInicial: number;
}) {
  const ahora = useRelojDisponibilidad(ahoraInicial);
  const catalogo = useCatalogo(datosIniciales);
  const { propiedades, total, pagina, porPagina, estado: estadoCarga } = catalogo;
  const { ciudad: filtroCiudad, zip: filtroZip } = catalogo.filtros;
  // Formulario de registro VIP
  const [nombre, setNombre] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [pais, setPais] = useState<PaisWhatsApp | ''>('');
  const [perfil, setPerfil] = useState<PerfilVip>('familia_vivienda');
  const [tieneItin, setTieneItin] = useState(false);
  const [leadEnviado, setLeadEnviado] = useState(false);
  const [enviandoLead, setEnviandoLead] = useState(false);
  const [errorLead, setErrorLead] = useState('');

  const registrarLead = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setEnviandoLead(true);
    setErrorLead('');
    try {
      const respuesta = await fetch('/api/compradores-vip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, whatsapp, pais, perfil, tiene_itin: tieneItin, sitio_web: new FormData(e.currentTarget).get('sitio_web') }),
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

  const filtradas = propiedades;
  const limpiarFiltros = () => catalogo.cambiarFiltros('', '');

  return (
    <main className="public-shell">
      <a className="skip-link" href="#inventario-publico">Saltar al inventario</a>
      <header className="brand-bar">
        <div className="public-wrap brand-header-layout">
          <Link href="/" className="brand-lockup" aria-label="Sergio Orantes | House FixAndFlip">
            <LogoMarca />
            <span translate="no"><strong>Sergio Orantes</strong><small>House FixAndFlip</small></span>
          </Link>
          <nav aria-label="Acciones del catálogo" className="brand-actions">
            <a href="#vende-tu-casa" className="brand-action brand-action-seller">
              <KeyRound size={18} aria-hidden="true" /> Vende tu casa
            </a>
            <a href="#lista-vip" className="brand-action brand-action-vip">
              <Bell size={18} aria-hidden="true" /> Lista VIP
            </a>
          </nav>
        </div>
      </header>

      <section className="catalog-hero">
        <div className="public-wrap hero-layout">
          <div className="hero-intro">
            <h1 className="catalog-title">Casas en el área de Phoenix</h1>
            <p>
              <strong className="mb-2 block text-xl leading-snug text-[var(--navy)] md:text-2xl">¡Oportunidades únicas en casas de subasta!</strong>
              ¡Precios que no encontrarás en el mercado! Invierte, remodela y gana con tu próximo proyecto de <strong>FIX &amp; FLIP</strong>.
            </p>
            <p>¡Yo te asesoro en cada paso del proceso! <strong className="text-[var(--navy)]">Propiedades off-market.</strong></p>
          </div>
          <div className="hero-tools">
            <p className="text-sm font-semibold">Encuentra tu próxima propiedad</p>
            <div className="grid items-start gap-3 sm:grid-cols-2">
              <SelectorCiudad label="Ciudad" ariaLabel="Ciudad" placeholder="Todas las ciudades"
                value={filtroCiudad} onChange={(ciudad) => catalogo.cambiarFiltros(ciudad, filtroZip)} />
              <label className="grid gap-1 text-sm font-semibold">ZIP
                <input className="vip-input h-[2.9rem]" type="text" inputMode="numeric" maxLength={5}
                  placeholder="Código postal" value={filtroZip}
                  onChange={(e) => catalogo.cambiarFiltros(filtroCiudad, e.target.value.replace(/\D/g, '').slice(0, 5))} />
              </label>
            </div>
            {(filtroCiudad || filtroZip) && <button className="public-action mt-3" type="button" onClick={limpiarFiltros}>Limpiar filtros</button>}
          </div>
          {estadoCarga === 'listo' && <dl className="hero-resumen" aria-label="Resumen del catálogo">
            <div><dt>{filtroCiudad || filtroZip ? 'Propiedades con estos filtros' : 'Propiedades disponibles'}</dt><dd>{total}</dd></div>
            <div><dt>Precio desde{filtroCiudad || filtroZip ? ' con estos filtros' : ''}</dt><dd>{catalogo.precioDesde != null ? <>{importeUsd(catalogo.precioDesde)} <small>USD</small></> : '—'}</dd></div>
          </dl>}


        </div>
      </section>

      <section aria-labelledby="inventario-publico" className="public-wrap py-8 md:py-11">
        <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-3 border-b border-[var(--line)] pb-3">
          <h2 id="inventario-publico" className="text-xl font-semibold tracking-tight">Propiedades</h2>
          {estadoCarga === 'listo' && <p aria-live="polite" className="text-sm text-[var(--muted)]">{total} {total === 1 ? 'resultado' : 'resultados'}</p>}
        </div>
        {estadoCarga === 'cargando' ? (
          <p role="status" className="public-panel text-center text-[var(--muted)] px-4 py-12">Cargando inventario…</p>
        ) : estadoCarga === 'error' ? (
          <div className="public-panel space-y-3 px-4 py-10 text-center">
            <p role="alert">{catalogo.error}</p>
            <button type="button" className="public-action" onClick={catalogo.actualizar}>Reintentar</button>
          </div>
        ) : filtradas.length === 0 ? (
          <p className="public-panel text-center text-[var(--muted)] px-4 py-12">
            {filtroCiudad || filtroZip ? 'Por ahora no hay casas disponibles con estos filtros.' : 'En este momento no hay casas disponibles en el catálogo.'}
            {' '}<a href="#lista-vip" className="underline">Recibir próximas casas en la Lista VIP</a>
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {filtradas.map((prop) => {
              const portada = enlacePortada(prop);
              const contacto = enlaceWhatsApp(prop);
              const diferencia = diferenciaArv(prop.precio, prop.arv);
              const porConfirmar = etiquetaDisponibilidad(prop.estado, prop.ultima_confirmacion, ahora) === 'Por confirmar';
              return (
                <article
                  key={prop.id}
                  className="property-card flex flex-col justify-between"
                >
                  <div>
                    <div className="relative">
                      <GaleriaPublica propiedad={prop.id} portada={portada} zona={prop.ciudad_zona} />
                      <span className={`status-pill absolute top-3 right-3 ${porConfirmar ? 'status-pending' : ''}`}>
                        {porConfirmar ? 'Por confirmar' : 'Disponible'}
                      </span>
                    </div>

                    <div className="space-y-4 px-5 pt-5 pb-4">
                      <div className="flex items-center gap-1.5 text-sm font-semibold text-[var(--muted)]">
                        <MapPin size={15} aria-hidden="true" /> {prop.ciudad_zona}
                      </div>

                      <div>
                        <p className="listing-price">
                          {importeUsd(prop.precio)}{' '}
                          <span className="text-xs font-medium tracking-normal text-[var(--muted)]">USD</span>
                        </p>
                        {prop.arv && (
                          <p className="listing-arv mt-1 text-sm font-semibold">
                            Precio del Mercado: {importeUsd(prop.arv)}
                          </p>
                        )}
                      </div>

                      {diferencia !== null && (
                        <p className="arv-badge"><TrendingUp size={16} aria-hidden="true" /> {importeUsd(diferencia)} por debajo del Precio del Mercado</p>
                      )}
                      <div className="property-specs">
                        {prop.beds != null && <span><BedDouble size={17} aria-hidden="true" /> {prop.beds} recámaras</span>}
                        {prop.baths != null && <span><Bath size={17} aria-hidden="true" /> {prop.baths} baños</span>}
                        {prop.sqft != null && <span><Maximize size={17} aria-hidden="true" /> {Number(prop.sqft).toLocaleString('en-US')} sqft</span>}
                      </div>
                    </div>
                  </div>

                  <div className="property-actions">
                    {contacto ? <a href={contacto} target="_blank" rel="noopener noreferrer"
                      className="public-action public-action-primary">
                      <MessageCircle size={16} aria-hidden="true" /> Pedir Dirección y Cita
                    </a> : <a className="public-action" href="#lista-vip">Unirme a la Lista VIP</a>}
                    <Link href={`/propiedades/${prop.id}`} className="public-action">
                      Ver ficha y fotos <ArrowUpRight size={15} aria-hidden="true" />
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
        {estadoCarga === 'listo' && total > porPagina && <nav aria-label="Páginas del catálogo" className="mt-6 flex items-center justify-center gap-3">
          <button className="public-action" disabled={pagina === 0} onClick={() => catalogo.cambiarPagina(pagina - 1)}>Anterior</button>
          <span>Página {pagina + 1} de {Math.ceil(total / porPagina)}</span>
          <button className="public-action" disabled={(pagina + 1) * porPagina >= total} onClick={() => catalogo.cambiarPagina(pagina + 1)}>Siguiente</button>
        </nav>}
        <button type="button" className="public-action mt-4" onClick={catalogo.actualizar}>Actualizar catálogo</button>
      </section>

      {/* Captura de Compradores VIP (independiente de Facebook) */}
      <VendeTuCasa />

      <section id="lista-vip" className="public-wrap scroll-mt-5 pb-12 md:pb-16">
        <div className="vip-banner">
          <div className="vip-intro">
            <h2 className="vip-title">Recibe las próximas propiedades por WhatsApp</h2>
            <p className="text-sm">
              Únete a la lista prioritaria. Al registrarte, aceptas que el vendedor te contacte por WhatsApp con nuevas oportunidades.
            </p>
          </div>
          {leadEnviado ? (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800">
              <CheckCircle2 size={18} /> ¡Listo! Ya quedaste registrado en nuestra lista
              prioritaria.
            </div>
          ) : (
            <form onSubmit={registrarLead} className="vip-form">
              <div hidden aria-hidden="true"><label>Sitio web<input name="sitio_web" tabIndex={-1} autoComplete="off" /></label></div>
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
              <div className="vip-telefono">
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
                <option value="familia_vivienda">Busco casa para vivir </option>
                <option value="inversionista">Soy inversionista </option>
              </select>
              <label className="vip-consentimiento flex min-h-11 cursor-pointer items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={tieneItin}
                  onChange={(e) => setTieneItin(e.target.checked)}
                  className="size-5 shrink-0 accent-[var(--blue)]"
                />
                Cuento con ITIN, pasaporte o enganche disponible.
              </label>
              {errorLead && <p role="alert" className="vip-consentimiento text-sm text-red-200">{errorLead}</p>}
              <button
                type="submit"
                disabled={enviandoLead}
                className="public-action vip-enviar"
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
