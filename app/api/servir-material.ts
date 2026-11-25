import { createHash } from 'node:crypto';
import { supabaseAdmin } from './admin-access';
import { respuestaFallo } from '../../lib/diagnostico';

export async function servirMaterial(request: Request, propiedad: string, archivo?: string) {
  const { data: ficha, error } = await supabaseAdmin.from('propiedades')
    .select('portada_publica_id,galeria_publica_ids,portada_legacy_hash')
    .eq('id', propiedad).not('publicada_en', 'is', null).eq('estado', 'disponible').maybeSingle();
  if (error && error.code !== '22P02') return respuestaFallo('material.consultar_publico', error);
  if (!ficha) return new Response(null, { status: 404 });
  const id = archivo ?? ficha.portada_publica_id;
  if (archivo && !((ficha.galeria_publica_ids ?? []) as string[]).includes(archivo)) return new Response(null, { status: 404 });
  let bytes: Buffer;
  let hash: string;
  if (id) {
    const { data: meta, error: fallo } = await supabaseAdmin.from('material_publico').select('contenido_hash')
      .eq('id', id).eq('propiedad_id', propiedad).maybeSingle();
    if (fallo) return respuestaFallo('material.metadatos', fallo);
    if (!meta?.contenido_hash) return new Response(null, { status: 404 });
    hash = meta.contenido_hash;
    const headers = { ETag: `"${hash}"`, 'Cache-Control': 'private, no-cache', 'X-Content-Type-Options': 'nosniff' };
    if (request.headers.get('if-none-match') === headers.ETag) return new Response(null, { status: 304, headers });
    const { data, error: lectura } = await supabaseAdmin.from('material_publico').select('contenido').eq('id', id).maybeSingle();
    if (lectura) return respuestaFallo('material.leer_publico', lectura);
    if (!data?.contenido) return new Response(null, { status: 404 });
    bytes = Buffer.from(data.contenido.slice(2), 'hex');
  } else {
    // Compatibilidad con copias de portada anteriores. Las visitas nunca consultan Drive.
    if (!ficha.portada_legacy_hash) return new Response(null, { status: 404 });
    const headers = { ETag: `"${ficha.portada_legacy_hash}"`, 'Cache-Control': 'private, no-cache' };
    if (request.headers.get('if-none-match') === headers.ETag) return new Response(null, { status: 304, headers });
    const { data: antigua, error: lectura } = await supabaseAdmin.from('propiedades').select('portada_webp').eq('id', propiedad)
      .not('publicada_en', 'is', null).eq('estado', 'disponible').maybeSingle();
    if (lectura) return respuestaFallo('material.leer_legacy', lectura);
    if (!antigua?.portada_webp) return new Response(null, { status: 404 });
    bytes = Buffer.from(antigua.portada_webp.slice(2), 'hex');
    hash = createHash('md5').update(bytes).digest('hex');
  }
  const headers = { 'Content-Type': 'image/webp', ETag: `"${hash}"`, 'Cache-Control': 'private, no-cache', 'X-Content-Type-Options': 'nosniff' };
  if (request.headers.get('if-none-match') === headers.ETag) return new Response(null, { status: 304, headers });
  return new Response(new Uint8Array(bytes), { headers });
}
