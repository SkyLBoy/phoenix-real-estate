import { cargarCatalogo } from '../../../lib/catalogo';
import { ciudadesPhoenix } from '../../../lib/ciudades-phoenix';
import { respuestaFallo } from '../../../lib/diagnostico';

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const ciudad = params.get('ciudad') ?? '';
  const zip = params.get('zip') ?? '';
  const pagina = Number(params.get('pagina') ?? 0);
  if ((ciudad && !ciudadesPhoenix.some((opcion) => opcion === ciudad)) || !/^\d{0,5}$/.test(zip)
    || !Number.isSafeInteger(pagina) || pagina < 0 || pagina > 100000) {
    return Response.json({ error: 'Revisa los filtros del catálogo.' }, { status: 400 });
  }
  const { datos, error } = await cargarCatalogo({ ciudad, zip, pagina });
  if (error) return respuestaFallo('catalogo.listar', error, 'No pudimos cargar las propiedades.');
  return Response.json(datos, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
