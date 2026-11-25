import { supabaseAdmin } from '../../../admin-access';
import { respuestaFallo } from '../../../../../lib/diagnostico';

export async function GET(_request: Request, context: RouteContext<'/api/propiedades/[id]/fotos'>) {
  const { id } = await context.params;
  const { data, error } = await supabaseAdmin.from('propiedades').select('galeria_publica_ids')
    .eq('id', id).not('publicada_en', 'is', null).eq('estado', 'disponible').maybeSingle();
  if (error && error.code !== '22P02') return respuestaFallo('galeria.listar', error);
  if (!data) return new Response(null, { status: 404 });
  return Response.json({ fotos: (data.galeria_publica_ids as string[]).map((foto) =>
    `/api/propiedades/${encodeURIComponent(id)}/fotos/${encodeURIComponent(foto)}`) }, { headers: { 'Cache-Control': 'no-store' } });
}
