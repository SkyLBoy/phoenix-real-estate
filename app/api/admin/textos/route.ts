import { canalesTexto, MAX_TEXTO, mismasCondiciones, requisitosTextos, type CanalTexto } from '../../../../lib/textos-propiedad';
import { rejectUnauthorizedAdmin, supabaseAdmin } from '../../admin-access';
import { camposAnuncio, datosAnuncio, generarTextos, validarCondiciones, type FichaAnuncio } from './generador';

const camposAprobacion = canalesTexto.map((canal) => `${canal}_aprobado` as const);
const sinAprobar = Object.fromEntries(camposAprobacion.map((campo) => [campo, false]));
const camposDevueltos = [...canalesTexto, ...camposAprobacion, 'textos_version', 'condiciones_texto'].join(',');

function error(mensaje: string, status: number) {
  return Response.json({ error: mensaje }, { status });
}

export async function POST(request: Request) {
  const denied = await rejectUnauthorizedAdmin(request);
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  const { id, version, accion } = body ?? {};
  if ((typeof id !== 'string' && typeof id !== 'number') || !id
    || !Number.isSafeInteger(version) || version < 0) return error('Identifica la ficha y su versión', 400);

  let cambios: Record<string, unknown>;
  let instantanea: Record<string, unknown> | undefined;
  let origen: 'gemini' | 'plantillas' | undefined;

  if (accion === 'generar') {
    const canal: CanalTexto | undefined = body.canal;
    if (canal !== undefined && !canalesTexto.includes(canal)) return error('Selecciona un texto válido', 400);
    const { data: ficha, error: consulta } = await supabaseAdmin.from('propiedades')
      .select([...camposAnuncio, 'condiciones_texto'].join(',')).eq('id', id).eq('textos_version', version).maybeSingle()
      .overrideTypes<(FichaAnuncio & { condiciones_texto: unknown }) | null, { merge: false }>();
    if (consulta) return error('No se pudo cargar la ficha', 500);
    if (!ficha) return error('La ficha o sus textos cambiaron. Recarga el inventario.', 409);

    const { condiciones_texto, ...datosFicha } = ficha;
    let condiciones;
    let cambiaronCondiciones;
    try {
      const guardadas = validarCondiciones(condiciones_texto);
      condiciones = body.condiciones === undefined ? guardadas : validarCondiciones(body.condiciones);
      cambiaronCondiciones = !mismasCondiciones(guardadas, condiciones);
    } catch (cause) {
      return error((cause as Error).message, 400);
    }
    const datos = datosAnuncio(datosFicha, condiciones);
    if (!datos) return error(requisitosTextos(ficha).join(' '), 400);

    const resultado = await generarTextos(datos, canal);
    const aprobaciones = canal && !cambiaronCondiciones ? { [`${canal}_aprobado`]: false } : sinAprobar;
    cambios = { ...resultado.textos, ...aprobaciones, condiciones_texto: condiciones };
    instantanea = datosFicha;
    origen = resultado.origen;
  } else if (accion === 'guardar' || accion === 'aprobar') {
    const canal: CanalTexto = body.canal;
    if (!canalesTexto.includes(canal)) return error('Selecciona un texto válido', 400);
    const texto = typeof body.texto === 'string' ? body.texto : '';
    if (!texto.trim() || texto.length > MAX_TEXTO) return error(`Escribe entre 1 y ${MAX_TEXTO} caracteres`, 400);

    const campoAprobado = `${canal}_aprobado`;
    if (accion === 'aprobar') {
      instantanea = { [canal]: texto };
      cambios = { [campoAprobado]: true };
    } else {
      cambios = { [canal]: texto.trim(), [campoAprobado]: false };
    }
  } else return error('Acción de texto inválida', 400);

  let consulta = supabaseAdmin.from('propiedades').update({ ...cambios, textos_version: version + 1 })
    .eq('id', id).eq('textos_version', version);
  for (const [campo, valor] of Object.entries(instantanea ?? {})) {
    consulta = valor == null ? consulta.is(campo, null) : consulta.eq(campo, valor);
  }
  const { data: textos, error: fallo } = await consulta.select(camposDevueltos).maybeSingle();
  if (fallo) return error('No se pudieron guardar los textos', 500);
  if (!textos) return error('La ficha o sus textos cambiaron. Recarga el inventario.', 409);

  return Response.json({ textos, origen }, { headers: { 'Cache-Control': 'private, no-store' } });
}
