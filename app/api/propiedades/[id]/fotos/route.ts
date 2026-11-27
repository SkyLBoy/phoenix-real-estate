import { supabaseAdmin } from '../../../admin-access';
import { respuestaFallo } from '../../../../../lib/diagnostico';

export async function GET(_request: Request, context: RouteContext<'/api/propiedades/[id]/fotos'>) {
  const { id } = await context.params;
  const { data, error } = await supabaseAdmin.from('propiedades').select('galeria_publica_ids,portada_publica_id')
    .eq('id', id).not('publicada_en', 'is', null).eq('estado', 'disponible').maybeSingle();
  if (error && error.code !== '22P02') return respuestaFallo('galeria.listar', error);
  if (!data) return new Response(null, { status: 404 });
  const base = `/api/propiedades/${encodeURIComponent(id)}`;
  const ids = (data.galeria_publica_ids ?? []) as string[];
  const portada = ids.includes(data.portada_publica_id) ? `${base}/portada` : null;
  const fotos = ids.map((foto) => foto === data.portada_publica_id ? `${base}/portada` : `${base}/fotos/${encodeURIComponent(foto)}`);
  return Response.json({ portada, fotos }, { headers: { 'Cache-Control': 'no-store' } });
}
