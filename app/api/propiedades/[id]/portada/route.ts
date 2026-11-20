import { supabaseAdmin } from '../../../admin-access';
import { abrirFotoDrive, listarFotosDrive } from '../../../drive';
import type { FotoDrive } from '@/lib/fotos-drive';

export async function GET(_request: Request, context: RouteContext<'/api/propiedades/[id]/portada'>) {
  const { id } = await context.params;
  const { data, error } = await supabaseAdmin.from('propiedades')
    .select('fotos_drive, portada_drive_id, drive_url')
    .eq('id', id).not('publicada_en', 'is', null).neq('estado', 'vendida').maybeSingle();
  if (error && error.code !== '22P02') return new Response(null, { status: 502 });
  const foto = (data?.fotos_drive as FotoDrive[] | undefined)?.find((item) => item.id === data?.portada_drive_id);
  if (!foto) return new Response(null, { status: 404 });
  try {
    const vigente = !process.env.GOOGLE_DRIVE_API_KEY?.trim() && data?.drive_url
      ? (await listarFotosDrive(data.drive_url).catch(() => [])).find(({ id }) => id === foto.id)
      : undefined;
    return await abrirFotoDrive(foto.id, vigente?.resourceKey ?? foto.resourceKey, vigente?.miniaturaDrive);
  } catch {
    return new Response(null, { status: 502 });
  }
}
