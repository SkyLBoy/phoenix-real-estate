import { respuestaFallo } from '../../../../lib/diagnostico';
import { NextResponse } from 'next/server';
import { esEstadoDisponibilidad, plazoConfirmacion } from '../../../../lib/disponibilidad';
import type { FotoDrive } from '../../../../lib/fotos-drive';
import { esZonaPublica } from '../../../../lib/zona-publica';
import { separarUbicacion } from '../../../../lib/ciudades-phoenix';
import { ErrorDrive, fotoParaPanel, identificadorDrive } from '../../drive';
import { camposFicha, camposInventario, urlPublica } from './campos';
import { rejectUnauthorizedAdmin, supabaseAdmin } from '../../admin-access';

export async function GET(req: Request) {
  const denied = await rejectUnauthorizedAdmin(req);
  if (denied) return denied;

  const params = new URL(req.url).searchParams;
  const pendientes = params.get('vista') === 'por_confirmar';
  const pagina = Number(params.get('pagina') ?? 0);
  if (!Number.isSafeInteger(pagina) || pagina < 0 || pagina > 1_000_000) {
    return NextResponse.json({ error: 'Página inválida' }, { status: 400 });
  }
  const porPagina = pendientes ? 10 : 25;
  const paginar = pendientes || params.has('pagina');
  let consulta = supabaseAdmin.from('propiedades').select(pendientes
    ? 'id,ciudad_zona,direccion_privada,ultima_confirmacion,publicada_en,estado' : camposInventario);
  if (pendientes) {
    const limite = new Date(Date.now() - plazoConfirmacion).toISOString();
    consulta = consulta.not('publicada_en', 'is', null).eq('estado', 'disponible')
      .or(`ultima_confirmacion.is.null,ultima_confirmacion.lte.${limite}`)
      .order('revision_desde').order('id');
  } else {
    consulta = consulta.order('created_at', { ascending: false }).order('id');
  }
  if (paginar) consulta = consulta.range(pagina * porPagina, (pagina + 1) * porPagina);
  const { data, error } = await consulta.overrideTypes<{ id: string; fotos_drive?: FotoDrive[] }[], { merge: false }>();

  if (error) {
    return respuestaFallo('propiedades.escribir', error);
  }

  const filas = paginar ? data.slice(0, porPagina) : data;
  const propiedades = filas.map((ficha) => ({
    ...ficha, ...(ficha.fotos_drive && { fotos_drive: ficha.fotos_drive.map(fotoParaPanel) }),
  }));
  return NextResponse.json({ propiedades, ...(paginar && { hayMas: data.length > porPagina }) }, {
    headers: { 'Cache-Control': 'private, no-store' },
  });
}

export async function PATCH(req: Request) {
  const denied = await rejectUnauthorizedAdmin(req);
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  const id = body?.id;
  if ((typeof id !== 'string' && typeof id !== 'number') || !id) {
    return NextResponse.json({ error: 'Identifica la ficha' }, { status: 400 });
  }

  if (body.accion === 'corregir_precio') {
    const { precio, precio_anterior } = body;
    if (typeof precio !== 'number' || !Number.isFinite(precio) || precio <= 0
      || !/^\d+(?:\.\d{1,2})?$/.test(String(precio))
      || typeof precio_anterior !== 'number' || !Number.isFinite(precio_anterior)) {
      return NextResponse.json({ error: 'Indica un precio positivo con hasta dos decimales' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin.from('propiedades')
      .update({ precio }).eq('id', id).eq('precio', precio_anterior).not('publicada_en', 'is', null)
      .select('precio,ficha_version,textos_version,script_fb_es_aprobado,script_fb_en_aprobado,script_wa_vip_aprobado,script_filtro_curiosos_aprobado')
      .maybeSingle();
    if (error) return respuestaFallo('propiedades.precio', error);
    if (!data) {
      return NextResponse.json({ error: 'La ficha debe estar publicada y conservar el precio que viste. Recarga el inventario.' }, { status: 409 });
    }
    return NextResponse.json({ ficha: data }, { headers: { 'Cache-Control': 'private, no-store' } });
  }

  if (body.accion === 'guardar_borrador' || body.accion === 'publicar' || body.accion === 'actualizar_material') {
    if (!Number.isSafeInteger(body.ficha_version) || body.ficha_version < 0) {
      return NextResponse.json({ error: 'Recarga la ficha para obtener su versión.' }, { status: 400 });
    }
    let cambios;
    const publicar = body.accion !== 'guardar_borrador';
    const nuevaPublicacion = body.accion === 'publicar';
    let zona: string | undefined;
    let portada: string | null = null;
    let portadaDrive: string | null = null;
    let carpeta: string | null = null;
    try {
      if (publicar) {
        portada = urlPublica(body.portada_revisada);
        if (body.portada_drive_revisada != null) {
          if (!identificadorDrive(body.portada_drive_revisada)) throw new Error('Portada de Drive inválida');
          portadaDrive = body.portada_drive_revisada;
        }
        if (!portada && !portadaDrive) throw new Error('Revisa la portada antes de publicar');
        carpeta = urlPublica(body.carpeta_revisada);
        if (body.confirmar_disponibilidad !== undefined && typeof body.confirmar_disponibilidad !== 'boolean') {
          throw new Error('Indica si acabas de confirmar la disponibilidad');
        }
        const { data: ficha, error } = await supabaseAdmin.from('propiedades')
          .select('ciudad_zona,estado,portada_drive_id,imagen_portada,drive_url,fotos_drive,publicada_en')
          .eq('id', id).eq('ficha_version', body.ficha_version).maybeSingle();
        if (error) return respuestaFallo('propiedades.consultar_borrador', error);
        if (!ficha || nuevaPublicacion !== (ficha.publicada_en === null)) return NextResponse.json({ error: 'Recarga el inventario para revisar el borrador.' }, { status: 409 });
        if (!esZonaPublica(ficha.ciudad_zona)) throw new Error('Guarda solo la ciudad o ZIP en la zona pública.');
        if (!separarUbicacion(ficha.ciudad_zona).ciudad) throw new Error('Selecciona una ciudad del área de Phoenix antes de publicar.');
        zona = ficha.ciudad_zona;
        if ((body.zona_revisada !== undefined && body.zona_revisada !== zona)
          || (portadaDrive !== (ficha.portada_drive_id ?? null))
          || (!portadaDrive && portada !== ficha.imagen_portada) || carpeta !== (ficha.drive_url ?? null)) {
          return NextResponse.json({ error: 'La zona o las fotos cambiaron. Revisa la ficha de nuevo.' }, { status: 409 });
        }
        if (body.confirmar_disponibilidad && ficha.estado !== 'disponible') throw new Error('Revisa el estado de la ficha.');
        const { portada_publica_id, galeria_publica_ids } = body;
        const uuid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
        if (body.material_revisado !== true || typeof portada_publica_id !== 'string' || !uuid.test(portada_publica_id)
          || !Array.isArray(galeria_publica_ids) || galeria_publica_ids.length > 12
          || !galeria_publica_ids.every((foto) => typeof foto === 'string' && uuid.test(foto))) {
          throw new Error('Prepara y revisa las fotos públicas antes de publicar.');
        }
        const ahora = new Date().toISOString();
        cambios = {
          ...(nuevaPublicacion && { publicada_en: ahora }),
          ...(body.confirmar_disponibilidad && { ultima_confirmacion: ahora }),
          portada_publica_id, galeria_publica_ids: [...new Set(galeria_publica_ids)],
        };
      } else {
        const { data: anterior, error } = await supabaseAdmin.from('propiedades')
          .select('drive_url,fotos_drive').eq('id', id).eq('ficha_version', body.ficha_version).is('publicada_en', null).maybeSingle();
        if (error) return respuestaFallo('borrador.consultar', error);
        if (!anterior) return NextResponse.json({ error: 'La ficha cambió. Tu edición se conserva. Recarga el inventario.' }, { status: 409 });
        cambios = await camposFicha(body.ficha, anterior);
      }
    } catch (error) {
      return NextResponse.json({ error: (error as Error).message }, { status: error instanceof ErrorDrive ? error.status : 400 });
    }

    let query = supabaseAdmin.from('propiedades').update(cambios)
      .eq('id', id).eq('ficha_version', body.ficha_version);
    query = nuevaPublicacion || !publicar ? query.is('publicada_en', null) : query.not('publicada_en', 'is', null);
    if (publicar) {
      query = query.eq('ciudad_zona', zona!);
      if (body.confirmar_disponibilidad) query = query.eq('estado', 'disponible');
      query = portadaDrive
        ? query.eq('portada_drive_id', portadaDrive)
        : query.is('portada_drive_id', null).eq('imagen_portada', portada!);
      query = carpeta ? query.eq('drive_url', carpeta) : query.is('drive_url', null);
    }
    const { data, error } = await query.select('id').maybeSingle();

    if (error?.code === '23514' && publicar) {
      return NextResponse.json({ error: 'Revisa zona, precio y que las fotos preparadas correspondan a esta versión de la ficha' }, { status: 400 });
    }
    if (error) return respuestaFallo('propiedades.escribir', error);
    if (!data) {
      return NextResponse.json({ error: 'Otra sesión cambió esta ficha. Tu edición sigue en el formulario. Recarga el inventario y revisa los cambios antes de volver a guardar.' }, { status: 409 });
    }
    return NextResponse.json({ ok: true });
  }

  const { estado } = body;
  if (body.accion != null || !esEstadoDisponibilidad(estado)) {
    return NextResponse.json({ error: 'Estado inválido' }, { status: 400 });
  }

  const cambios = estado === 'disponible'
    ? { estado, ultima_confirmacion: new Date().toISOString() }
    : { estado };
  const { data, error } = await supabaseAdmin.from('propiedades')
    .update(cambios).eq('id', id)
    .select('id,estado,ultima_confirmacion,ficha_version').maybeSingle();

  if (error) return respuestaFallo('propiedades.escribir', error);
  if (!data) return NextResponse.json({ error: 'La ficha ya no existe' }, { status: 404 });
  return NextResponse.json({ ok: true, disponibilidad: data });

}

export async function DELETE(req: Request) {
  const denied = await rejectUnauthorizedAdmin(req);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  const { error } = await supabaseAdmin
    .from('propiedades')
    .delete()
    .eq('id', id);

  if (error) {
    return respuestaFallo('propiedades.escribir', error);
  }

  return NextResponse.json({ ok: true });
}
