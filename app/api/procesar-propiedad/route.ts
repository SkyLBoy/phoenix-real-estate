import { NextResponse } from 'next/server';
import { rejectUnauthorizedAdmin, supabaseAdmin } from '../admin-access';
import { ErrorDrive } from '../drive';
import { camposFicha } from '../admin/propiedades/campos';
import { datosAnuncio, generarTextos } from '../admin/textos/generador';
import { canalesTexto } from '../../../lib/textos-propiedad';

export async function POST(req: Request) {
  try {
    const denied = await rejectUnauthorizedAdmin(req);
    if (denied) return denied;

    const body = await req.json();
    let ficha;
    try {
      ficha = await camposFicha(body);
    } catch (error) {
      return NextResponse.json({ error: (error as Error).message }, { status: error instanceof ErrorDrive ? error.status : 400 });
    }
    const datos = body.generar_anuncios === false ? null : datosAnuncio(ficha, {});
    const textos = datos ? (await generarTextos(datos)).textos : {};

    const { data, error } = await supabaseAdmin
      .from('propiedades')
      .insert([
        {
          ...ficha,
          publicada_en: null,
          ...Object.fromEntries(canalesTexto.map((canal) => [canal, ''])),
          ...textos,
        },
      ])
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, propiedad: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}