import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, FolderOpen, House, MessageCircle } from 'lucide-react';
import { Suspense } from 'react';
import { CAMPOS_PUBLICOS, enlacePortada, enlaceWhatsApp } from '@/lib/propiedades-publicas';
import { EtiquetaDisponibilidad } from './etiqueta-disponibilidad';
import { supabase } from '@/lib/supabase';

async function Ficha({ params }: PageProps<'/propiedades/[id]'>) {
  const { id } = await params;
  const { data: prop, error } = await supabase
    .from('propiedades_publicas')
    .select(CAMPOS_PUBLICOS)
    .eq('id', id)
    .maybeSingle();

  if (error && error.code !== '22P02') throw new Error('No se pudo cargar la ficha');
  if (!prop) notFound();

  return (
    <main className="public-shell">
      <header className="brand-bar">
        <div className="public-wrap">
          <Link href="/" className="brand-lockup" aria-label="Sergio Orantes | House FixAndFlip">
            <span className="brand-mark"><House size={20} aria-hidden="true" /></span>
            <span><strong>Sergio Orantes</strong><small>House FixAndFlip</small></span>
          </Link>
        </div>
      </header>
      <article className="public-wrap space-y-5 py-6 md:space-y-7 md:py-10">
        <Link href="/" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--blue)]">
          <ArrowLeft size={17} aria-hidden="true" /> Ver casas disponibles
        </Link>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">{prop.ciudad_zona}</h1>
          <EtiquetaDisponibilidad estado={prop.estado} ultimaConfirmacion={prop.ultima_confirmacion} />
        </div>
        {prop.estado !== 'disponible' ? (
          <div className="public-panel space-y-3 p-5">
            <p>{prop.estado === 'en_contrato'
              ? 'Hay un trato en curso para esta propiedad.'
              : 'Esta propiedad salió del inventario.'}</p>
            <Link href="/" className="public-action public-action-primary">
              Explorar otras propiedades
            </Link>
          </div>
        ) : (
          <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.68fr)_minmax(0,1fr)]">
            <div className="listing-photo listing-photo-detail rounded-xl">
              {/* La portada tiene una URL dinámica de Drive. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={enlacePortada(prop) ?? undefined} alt={`Portada de propiedad en ${prop.ciudad_zona}`} />
            </div>
            <div className="public-panel space-y-5 p-5 md:p-7">
              <div>
                <p className="text-sm font-medium text-[var(--muted)]">Precio de venta</p>
                <p className="listing-price mt-1">${Number(prop.precio).toLocaleString()} <span className="text-xs tracking-normal text-[var(--muted)]">USD</span></p>
                {prop.arv != null && <p className="listing-arv mt-2 font-semibold">ARV estimado: ${Number(prop.arv).toLocaleString()} USD</p>}
              </div>
              <ul className="flex flex-wrap gap-x-4 gap-y-2 border-y border-[var(--line)] py-4 text-sm text-[var(--muted)]">
                {prop.beds != null && <li>{prop.beds} recámaras</li>}
                {prop.baths != null && <li>{prop.baths} baños</li>}
                {prop.sqft != null && <li>{prop.sqft} sqft</li>}
                {prop.lot_size && <li>Lote: {prop.lot_size}</li>}
                {prop.year_built != null && <li>Año: {prop.year_built}</li>}
              </ul>
              <div className="grid gap-2">
                <a href={enlaceWhatsApp(prop)} target="_blank" rel="noopener noreferrer" className="public-action public-action-primary">
                  <MessageCircle size={17} aria-hidden="true" /> Consultar por WhatsApp
                </a>
                {prop.drive_url && (
                  <a href={prop.drive_url} target="_blank" rel="noopener noreferrer" className="public-action">
                    <FolderOpen size={17} aria-hidden="true" /> Ver fotos y videos en Drive
                  </a>
                )}
              </div>
            </div>
          </div>
        )}
      </article>
    </main>
  );
}

export default function Propiedad(props: PageProps<'/propiedades/[id]'>) {
  return <Suspense fallback={<p role="status">Cargando ficha…</p>}><Ficha {...props} /></Suspense>;
}
