import { createHash } from 'node:crypto';
import { optimizarFotoPublica } from '../../portada-drive';
import { rejectUnauthorizedAdmin, supabaseAdmin } from '../../admin-access';
import { descargarImagenPortada } from '../../foto-original-drive';
import { respuestaFallo } from '../../../../lib/diagnostico';
import type { FotoDrive } from '../../../../lib/fotos-drive';

export async function GET(request: Request) {
  const denegado = await rejectUnauthorizedAdmin(request);
  if (denegado) return denegado;
  const id = new URL(request.url).searchParams.get('archivo');
  if (!id || !/^[\da-f-]{36}$/i.test(id)) return new Response(null, { status: 400 });
  const { data, error } = await supabaseAdmin.from('material_publico').select('contenido').eq('id', id).maybeSingle();
  if (error) return respuestaFallo('material.previsualizar', error);
  if (!data?.contenido) return new Response(null, { status: 404 });
  return new Response(Buffer.from(data.contenido.slice(2), 'hex'), {
    headers: { 'Content-Type': 'image/webp', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}

export async function POST(request: Request) {
  const denegado = await rejectUnauthorizedAdmin(request);
  if (denegado) return denegado;
  const params = new URL(request.url).searchParams;
  const id = params.get('id');
  const version = params.has('version') ? Number(params.get('version')) : NaN;
  const fuente = params.get('fuente');
  if (!id || !fuente || !Number.isSafeInteger(version) || version < 0) {
    return Response.json({ error: 'Identifica la ficha, la versión y la foto.' }, { status: 400 });
  }
  const { data: ficha, error } = await supabaseAdmin.from('propiedades').select('fotos_drive,portada_drive_id,imagen_portada')
    .eq('id', id).eq('ficha_version', version).maybeSingle();
  if (error) return respuestaFallo('material.consultar_ficha', error);
  if (!ficha) return Response.json({ error: 'La ficha cambió. Recarga el inventario.' }, { status: 409 });
  const foto = (ficha.fotos_drive as FotoDrive[] | null)?.find((item) => item.id === fuente);
  const alternativa = fuente === 'portada-alternativa' && !ficha.portada_drive_id && ficha.imagen_portada;
  if (!foto && !alternativa) return Response.json({ error: 'Selecciona una foto guardada en la ficha.' }, { status: 400 });

  let subida: Buffer | undefined;
  try { if (alternativa) subida = await leerSubida(request); }
  catch (causa) { return respuestaFallo('material.subida', causa, 'Elige un archivo de imagen de hasta 4 MB.', 400); }
  const origen = subida ? `${fuente}:${createHash('sha256').update(subida).digest('hex')}` : fuente;
  const { data: existente, error: consulta } = await supabaseAdmin.from('material_publico').select('id,contenido_hash')
    .eq('propiedad_id', String(id)).eq('ficha_version', version).eq('fuente', origen).maybeSingle();
  if (consulta) return respuestaFallo('material.consultar_copia', consulta);
  if (existente?.contenido_hash) return Response.json({ id: existente.id, fuente });
  const { data: reservas, error: reserva } = await supabaseAdmin.rpc('reservar_material', { propiedad: String(id), version, origen });
  if (reserva) return respuestaFallo('material.reservar', reserva);
  const trabajo = reservas?.[0];
  if (!trabajo) return Response.json({ error: 'Esta foto se está preparando o la ficha cambió. Intenta nuevamente.' }, { status: 409 });
  try {
    let bytes: Buffer;
    if (foto) bytes = (await descargarImagenPortada(foto)).bytes;
    else {
      // La portada alternativa se copia desde un archivo revisado, sin descargar URLs arbitrarias en el servidor.
      bytes = subida!;
    }
    const imagen = await optimizarFotoPublica(bytes);
    const { data: guardada, error: fallo } = await supabaseAdmin.from('material_publico')
      .update({ contenido: '\\x' + imagen.toString('hex'), contenido_hash: createHash('sha256').update(imagen).digest('hex') })
      .eq('id', trabajo.id).eq('token', trabajo.token).select('id').maybeSingle();
    if (fallo) return respuestaFallo('material.guardar', fallo);
    if (!guardada) return Response.json({ error: 'La preparación cambió. Vuelve a intentarlo.' }, { status: 409 });
    return Response.json({ id: guardada.id, fuente });
  } catch (causa) {
    // Libera únicamente la reserva propia. Un fallo parcial conserva las demás fotos preparadas.
    const { error: liberar } = await supabaseAdmin.from('material_publico').update({ vence: new Date(0).toISOString() })
      .eq('id', trabajo.id).eq('token', trabajo.token).is('contenido', null);
    if (liberar) return respuestaFallo('material.liberar', liberar);
    return respuestaFallo('material.preparar', causa, 'No se pudo preparar la foto. Revisa que sea pública y una imagen válida.');
  }
}

async function leerSubida(request: Request) {
      const partes: Uint8Array[] = [];
      let total = 0;
      const lector = request.body?.getReader();
      if (!lector) throw new Error('Selecciona un archivo de imagen.');
      try {
        while (true) {
          const { done, value } = await lector.read();
          if (done) break;
          total += value.byteLength;
          if (total > 4 * 1024 * 1024) { await lector.cancel(); throw new Error('Elige una imagen de hasta 4 MB.'); }
          partes.push(value);
        }
      } finally { lector.releaseLock(); }
      return Buffer.concat(partes);
}
