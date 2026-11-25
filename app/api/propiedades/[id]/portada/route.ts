import { servirMaterial } from '../../../servir-material';

export async function GET(request: Request, context: RouteContext<'/api/propiedades/[id]/portada'>) {
  const { id } = await context.params;
  return servirMaterial(request, id);
}
