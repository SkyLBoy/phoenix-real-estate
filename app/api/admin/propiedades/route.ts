import { NextResponse } from 'next/server';
import { esEstadoDisponibilidad } from '../../../../lib/disponibilidad';
import { ErrorDrive, fotoParaPanel, identificadorDrive } from '../../drive';
import { camposFicha, urlPublica } from './campos';
import { rejectUnauthorizedAdmin, supabaseAdmin } from '../../admin-access';

export async function GET(req: Request) {
  const denied = await rejectUnauthorizedAdmin(req);
  if (denied) return denied;

  const { data, error } = await supabaseAdmin
    .from('propiedades')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const propiedades = data.map((propiedad) => ({
    ...propiedad,
    ...(propiedad.fotos_drive ? { fotos_drive: propiedad.fotos_drive.map(fotoParaPanel) } : {}),
  }));
  return NextResponse.json({ propiedades }, {
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
      .select('precio,textos_version,script_fb_es_aprobado,script_fb_en_aprobado,script_wa_vip_aprobado,script_filtro_curiosos_aprobado')
      .maybeSingle();
    if (error) return NextResponse.json({ error: 'No se pudo guardar el precio' }, { status: 500 });
    if (!data) {
      return NextResponse.json({ error: 'La ficha debe estar publicada y conservar el precio que viste. Recarga el inventario.' }, { status: 409 });
    }
    return NextResponse.json({ ficha: data }, { headers: { 'Cache-Control': 'private, no-store' } });
  }

  if (body.accion === 'guardar_borrador' || body.accion === 'publicar') {
    let cambios;
    const publicar = body.accion === 'publicar';
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
        const ahora = new Date().toISOString();
        cambios = { publicada_en: ahora, ultima_confirmacion: ahora };
      } else {
        cambios = await camposFicha(body.ficha);
      }
    } catch (error) {
      return NextResponse.json({ error: (error as Error).message }, { status: error instanceof ErrorDrive ? error.status : 400 });
    }

    let query = supabaseAdmin.from('propiedades').update(cambios)
      .eq('id', id).is('publicada_en', null);
    if (publicar) {
      query = portadaDrive
        ? query.eq('portada_drive_id', portadaDrive)
        : query.is('portada_drive_id', null).eq('imagen_portada', portada!);
      query = carpeta ? query.eq('drive_url', carpeta) : query.is('drive_url', null);
    }
    const { data, error } = await query.select('id').maybeSingle();

    if (error?.code === '23514' && publicar) {
      return NextResponse.json({ error: 'Completa la zona, un precio mayor que cero y la portada antes de publicar' }, { status: 400 });
    }
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) {
      return NextResponse.json({ error: 'La ficha o sus enlaces cambiaron. Vuelve a cargar el inventario.' }, { status: 409 });
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
    .select('id,estado,ultima_confirmacion').maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}