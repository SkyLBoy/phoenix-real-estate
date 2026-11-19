import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { CAMPOS_PUBLICOS, enlacePortada, enlaceWhatsApp } from '@/lib/propiedades-publicas';
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
    <main className="min-h-screen bg-zinc-950 px-4 py-8 text-zinc-100">
      <article className="mx-auto max-w-xl space-y-5">
        <Link href="/" className="text-sm text-amber-300">Ver catálogo</Link>
        <h1 className="text-3xl font-bold">{prop.ciudad_zona}</h1>
        {prop.estado === 'vendida' ? (
          <p>Esta propiedad ya no está disponible.</p>
        ) : (
          <>
            {prop.estado === 'en_contrato' && <p className="text-amber-300">En contrato</p>}
            {/* Las portadas se proporcionan mediante URL de origen variable. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={enlacePortada(prop) ?? undefined} alt={`Portada de propiedad en ${prop.ciudad_zona}`}
              className="max-h-96 w-full rounded-xl object-cover" />
            <p className="text-xl font-semibold">${Number(prop.precio).toLocaleString()} USD</p>
            {prop.arv != null && <p>ARV estimado: ${Number(prop.arv).toLocaleString()} USD</p>}
            <ul className="flex flex-wrap gap-4 text-sm text-zinc-300">
              {prop.beds != null && <li>{prop.beds} recámaras</li>}
              {prop.baths != null && <li>{prop.baths} baños</li>}
              {prop.sqft != null && <li>{prop.sqft} sqft</li>}
              {prop.lot_size && <li>Lote: {prop.lot_size}</li>}
              {prop.year_built != null && <li>Año: {prop.year_built}</li>}
            </ul>
            {prop.drive_url && (
              <a href={prop.drive_url} target="_blank" rel="noopener noreferrer"
                className="block text-amber-300">Ver fotos y videos en Drive</a>
            )}
            <a href={enlaceWhatsApp(prop)} target="_blank" rel="noopener noreferrer"
              className="inline-block rounded-lg bg-emerald-700 px-4 py-2 font-semibold">
              Consultar por WhatsApp
            </a>
          </>
        )}
      </article>
    </main>
  );
}

export default function Propiedad(props: PageProps<'/propiedades/[id]'>) {
  return <Suspense fallback={<p role="status">Cargando ficha…</p>}><Ficha {...props} /></Suspense>;
}
