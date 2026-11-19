import { NextResponse } from 'next/server';
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

  const { id, estado } = await req.json();

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