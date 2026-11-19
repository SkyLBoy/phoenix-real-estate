import { NextResponse } from 'next/server';
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

  return NextResponse.json({ propiedades: data }, {
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

  if (body.accion === 'guardar_borrador' || body.accion === 'publicar') {
    let cambios;
    let portada: string | null = null;
    let carpeta: string | null = null;
    try {
      if (body.accion === 'publicar') {
        portada = urlPublica(body.portada_revisada);
        if (!portada) throw new Error('Revisa la portada antes de publicar');
        carpeta = urlPublica(body.carpeta_revisada);
        const ahora = new Date().toISOString();
        cambios = { publicada_en: ahora, ultima_confirmacion: ahora };
      } else {
        cambios = camposFicha(body.ficha);
      }
    } catch (error) {
      return NextResponse.json({ error: (error as Error).message }, { status: 400 });
    }

    let query = supabaseAdmin.from('propiedades').update(cambios)
      .eq('id', id).is('publicada_en', null);
    if (portada) {
      query = query.eq('imagen_portada', portada);
      query = carpeta ? query.eq('drive_url', carpeta) : query.is('drive_url', null);
    }
    const { data, error } = await query.select('id').maybeSingle();

    if (error?.code === '23514' && portada) {
      return NextResponse.json({ error: 'Completa la zona, un precio mayor que cero y la portada antes de publicar' }, { status: 400 });
    }
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) {
      return NextResponse.json({ error: 'La ficha o sus enlaces cambiaron. Vuelve a cargar el inventario.' }, { status: 409 });
    }
    return NextResponse.json({ ok: true });
  }

  const { estado } = body;
  if (!['disponible', 'en_contrato', 'vendida'].includes(estado)) {
    return NextResponse.json({ error: 'Estado inválido' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('propiedades')
    .update({ estado })
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
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