import { LogoMarca } from '@/app/logo-marca';
import { GaleriaPublica } from '@/app/galeria-publica';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { ArrowLeft, MessageCircle, TrendingUp } from 'lucide-react';
import { cache, Suspense } from 'react';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { importeUsd, diferenciaArv } from '@/app/metricas-propiedad';
import { CAMPOS_PUBLICOS, enlacePortada, enlaceWhatsApp, type PropiedadPublica } from '@/lib/propiedades-publicas';
import { cargarSimilares } from '@/lib/propiedades-similares';
import { horaDeSolicitud } from '@/lib/hora-de-solicitud';
import { EtiquetaDisponibilidad } from './etiqueta-disponibilidad';
import { supabase } from '@/lib/supabase';

async function CasasSimilares({ referencia }: { referencia: PropiedadPublica }) {
  await connection();
  const casas = await cargarSimilares(referencia);
  if (!casas.length) return null;
  return (
    <section aria-labelledby="titulo-similares" className="space-y-3">
      <h2 id="titulo-similares" className="editorial-title text-2xl">Casas disponibles en la zona</h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {casas.map((casa) => (
          <li key={casa.id}>
            <Link href={`/propiedades/${encodeURIComponent(casa.id)}`}
              className="public-panel flex h-full flex-col items-start gap-2 p-5 hover:underline">
              <span>{casa.ciudad_zona}</span>
              <strong className="text-xl tabular-nums">{importeUsd(casa.precio)} USD</strong>
              <span className="text-sm text-[var(--blue)]">Ver ficha y fotos</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

const cargarFichaPublica = cache(async (id: string) => {
  const { data, error } = await supabase
    .from('propiedades_publicas')
    .select(CAMPOS_PUBLICOS)
    .eq('id', id)
    .maybeSingle();
  if (error && error.code !== '22P02') throw new Error('No se pudo cargar la ficha');
  return data;
});

export async function generateMetadata({ params }: PageProps<'/propiedades/[id]'>): Promise<Metadata> {
  const { id } = await params;
  const prop = await cargarFichaPublica(id).catch(() => null);
  if (!prop) return {};
  const title = `${prop.ciudad_zona} · ${importeUsd(prop.precio)} USD`;
  const description = prop.estado === 'disponible'
    ? 'Consulta las fotos y los detalles de esta propiedad.'
    : 'Consulta el estado de esta ficha y encuentra otras propiedades en la zona.';
  const portada = prop.estado === 'disponible' ? enlacePortada(prop) : null;
  let imagen = portada;
  if (portada?.startsWith('/')) {
    const cabeceras = await headers();
    const host = cabeceras.get('host');
    const protocolo = cabeceras.get('x-forwarded-proto') === 'http' ? 'http' : 'https';
    imagen = host ? new URL(portada, `${protocolo}://${host}`).href : null;
  }
  return { title, description, openGraph: { title, description, ...(imagen && { images: [imagen] }) } };
}

async function Ficha({ params }: PageProps<'/propiedades/[id]'>) {
  await connection();
  const { id } = await params;
  const prop = await cargarFichaPublica(id);
  if (!prop) notFound();
  const diferencia = diferenciaArv(prop.precio, prop.arv);
  const contacto = enlaceWhatsApp(prop);

  return (
    <main className="public-shell">
      <header className="brand-bar">
        <div className="public-wrap">
          <Link href="/" className="brand-lockup" aria-label="Sergio Orantes | House FixAndFlip">
            <LogoMarca />
            <span translate="no"><strong>Sergio Orantes</strong><small>House FixAndFlip</small></span>
          </Link>
        </div>
      </header>
      <article className="public-wrap space-y-5 py-6 md:space-y-7 md:py-10">
        <Link href="/" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--blue)]">
          <ArrowLeft size={17} aria-hidden="true" /> Ver casas disponibles
        </Link>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="editorial-title text-4xl md:text-6xl">{prop.ciudad_zona}</h1>
          <EtiquetaDisponibilidad estado={prop.estado} ultimaConfirmacion={prop.ultima_confirmacion} ahoraInicial={horaDeSolicitud()} />
        </div>
        {prop.estado !== 'disponible' ? (
          <>
            <div className="public-panel space-y-3 p-5">
              <p>{prop.estado === 'en_contrato'
                ? 'Hay un trato en curso para esta propiedad.'
                : 'Esta propiedad salió del inventario.'}</p>
              <div className="flex flex-wrap gap-2">
                {contacto ? (
                  <a href={contacto} target="_blank" rel="noopener noreferrer" className="public-action public-action-primary">
                    <MessageCircle size={17} aria-hidden="true" /> Preguntarle a Sergio por una casa similar en {prop.ciudad_zona}
                  </a>
                ) : <Link href="/#lista-vip" className="public-action public-action-primary">Recibir próximas casas en la Lista VIP</Link>}
                <Link href="/" className="public-action">Explorar otras propiedades</Link>
              </div>
            </div>
            <Suspense fallback={null}><CasasSimilares referencia={prop} /></Suspense>
          </>
        ) : (
          <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.68fr)_minmax(0,1fr)]">
            <div className="space-y-5">
              <GaleriaPublica propiedad={prop.id} portada={enlacePortada(prop)} zona={prop.ciudad_zona} detalle />
            </div>
            <div className="public-panel space-y-5 p-5 md:p-7">
              <div>
                <p className="text-sm font-medium text-[var(--muted)]">Precio de venta</p>
                <p className="listing-price mt-1">{importeUsd(prop.precio)} <span className="text-xs tracking-normal text-[var(--muted)]">USD</span></p>
                {prop.arv != null && <p className="listing-arv mt-2 font-semibold">Precio del Mercado: {importeUsd(prop.arv)} USD</p>}
              </div>
              {diferencia !== null && <p className="arv-badge"><TrendingUp size={16} aria-hidden="true" /> {importeUsd(diferencia)} por debajo del Precio del Mercado</p>}
              <ul className="flex flex-wrap gap-x-4 gap-y-2 border-y border-[var(--line)] py-4 text-sm text-[var(--muted)]">
                {prop.beds != null && <li>{prop.beds} recámaras</li>}
                {prop.baths != null && <li>{prop.baths} baños</li>}
                {prop.sqft != null && <li>{prop.sqft} sqft</li>}
                {prop.lot_size && <li>Lote: {prop.lot_size}</li>}
                {prop.year_built != null && <li>Año: {prop.year_built}</li>}
              </ul>
              <div className="grid gap-2">
                {contacto ? <a href={contacto} target="_blank" rel="noopener noreferrer" className="public-action public-action-primary">
                  <MessageCircle size={17} aria-hidden="true" /> Consultar por WhatsApp
                </a> : <Link href="/#lista-vip" className="public-action public-action-primary">Unirme a la Lista VIP</Link>}

              </div>
            </div>
          </div>
        )}
      </article>
    </main>
  );
}

export default function Propiedad(props: PageProps<'/propiedades/[id]'>) {
  return <Suspense fallback={<main className="public-shell"><p role="status" className="public-wrap py-12">Cargando ficha…</p></main>}><Ficha {...props} /></Suspense>;
}
