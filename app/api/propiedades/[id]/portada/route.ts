import { supabaseAdmin } from '../../../admin-access';
import { abrirFotoDrive } from '../../../drive';
import { crearCopiaPortada } from '../../../portada-drive';
import type { FotoDrive } from '@/lib/fotos-drive';

function servirWebp(bytea: string) {
  return new Response(Buffer.from(bytea.slice(2), 'hex'), { headers: {
    'Content-Type': 'image/webp',
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
  } });
}

export async function GET(_request: Request, context: RouteContext<'/api/propiedades/[id]/portada'>) {
  const { id } = await context.params;
  const { data, error } = await supabaseAdmin.from('propiedades')
    .select('fotos_drive,portada_drive_id,portada_webp')
    .eq('id', id).not('publicada_en', 'is', null).eq('estado', 'disponible').maybeSingle();
  if (error && error.code !== '22P02') return new Response(null, { status: 502 });
  if (!data) return new Response(null, { status: 404 });
  if (data.portada_webp) return servirWebp(data.portada_webp);

  // Fichas publicadas antes de guardar portadas en la base.
  const fotos = data.fotos_drive as FotoDrive[];
  const foto = fotos?.find((item) => item.id === data.portada_drive_id);
  if (!foto) return new Response(null, { status: 404 });
  try {
    const copia = await crearCopiaPortada(fotos, foto.id);
    const { data: guardada, error: fallo } = await supabaseAdmin.from('propiedades')
      .update({ portada_webp: copia }).eq('id', id).eq('portada_drive_id', foto.id)
      .not('publicada_en', 'is', null).eq('estado', 'disponible').select('id').maybeSingle();
    if (fallo) return new Response(null, { status: 502 });
    if (!guardada) return new Response(null, { status: 404 });
    return servirWebp(copia);
  } catch {
    try {
      return await abrirFotoDrive(foto.id, foto.resourceKey, foto.miniaturaDrive);
    } catch {
      return new Response(null, { status: 502 });
    }
  }
}
