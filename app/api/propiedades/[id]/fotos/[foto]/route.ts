import { servirMaterial } from '../../../../servir-material';

export async function GET(request: Request, context: RouteContext<'/api/propiedades/[id]/fotos/[foto]'>) {
  const { id, foto } = await context.params;
  return servirMaterial(request, id, foto);
}
