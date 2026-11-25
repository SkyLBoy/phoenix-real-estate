import { respuestaFallo } from '../../lib/diagnostico';
import { createHmac } from 'node:crypto';
import { supabaseAdmin } from './admin-access';

export async function leerEnvioPublico(request: Request) {
  if (!request.body) return null;
  const lector = request.body.getReader();
  const partes: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await lector.read();
      if (done) break;
      total += value.byteLength;
      if (total > 16384) {
        await lector.cancel();
        throw new Error('El formulario supera el tamaño permitido.');
      }
      partes.push(value);
    }
    return JSON.parse(Buffer.concat(partes).toString('utf8'));
  } finally {
    lector.releaseLock();
  }
}

export async function registrarEnvioPublico(canal: 'vip' | 'casa', datos: Record<string, unknown>) {
  const secreto = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const huella = (valor: string) => createHmac('sha256', secreto).update(valor).digest('hex');
  const { data, error } = await supabaseAdmin.rpc('registrar_envio_publico', {
    canal, clave: huella(`${canal}:${JSON.stringify(datos)}`),
    contacto: huella(String(datos.whatsapp)), datos,
  });
  if (error || !['registrado', 'repetido', 'limitado'].includes(data)) {
    return respuestaFallo(`captacion.${canal}`, error, 'No se pudo guardar el envío. Intenta de nuevo.');
  }
  if (data === 'limitado') return Response.json({ error: 'Has enviado varias solicitudes. Intenta nuevamente más tarde.' }, {
    status: 429, headers: { 'Retry-After': '3600' },
  });
  return Response.json({ ok: true }, { status: 201 });
}
