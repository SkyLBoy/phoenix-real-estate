import { rejectUnauthorizedAdmin } from '../../admin-access';
import { abrirFotoDrive, ErrorDrive, fotoParaPanel, listarFotosDrive } from '../../drive';

export async function GET(request: Request) {
  const denied = await rejectUnauthorizedAdmin(request);
  if (denied) return denied;

  const params = new URL(request.url).searchParams;
  try {
    const id = params.get('foto');
    if (id) return await abrirFotoDrive(id, params.get('clave') ?? undefined);
    const carpeta = params.get('carpeta');
    if (!carpeta) return Response.json({ error: 'Indica la carpeta de Drive' }, { status: 400 });
    return Response.json({ fotos: (await listarFotosDrive(carpeta)).map(fotoParaPanel) }, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    if (error instanceof ErrorDrive) return Response.json({ error: error.message }, { status: error.status });
    return Response.json({ error: 'No se pudieron cargar las fotos de Drive' }, { status: 502 });
  }
}
