import { respuestaFallo } from '../../../../lib/diagnostico';
import { rejectUnauthorizedAdmin } from '../../admin-access';
import { abrirFotoDrive, ErrorDrive, fotoParaPanel, listarFotosDrive } from '../../drive';
import { descargarOriginalDrive, descargarVistaDrive } from '../../foto-original-drive';

export async function GET(request: Request) {
  const denied = await rejectUnauthorizedAdmin(request);
  if (denied) return denied;

  const params = new URL(request.url).searchParams;
  try {
    const id = params.get('foto');
    if (id && (params.get('original') === '1' || params.get('vista') === '1')) {
      const { bytes, tipo } = await (params.get('vista') === '1' ? descargarVistaDrive : descargarOriginalDrive)(id, params.get('clave') ?? undefined);
      const imagen = new Blob([Uint8Array.from(bytes)]);
      return new Response(imagen.stream(), { headers: {
        'Content-Type': tipo,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      } });
    }
    if (id) return await abrirFotoDrive(id, params.get('clave') ?? undefined);
    const carpeta = params.get('carpeta');
    if (!carpeta) return Response.json({ error: 'Indica la carpeta de Drive' }, { status: 400 });
    return Response.json({ fotos: (await listarFotosDrive(carpeta)).map(fotoParaPanel) }, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    if (error instanceof ErrorDrive) {
      if (error.status >= 422) return respuestaFallo('drive.cargar', error, error.message, error.status);
      return Response.json({ error: error.message }, { status: error.status });
    }
    return respuestaFallo('drive.cargar_inesperado', error, 'No se pudieron cargar las fotos de Drive.', 502);
  }
}
