import { condicionesCasa } from '../../lib/casas-ofrecidas';
import { normalizarWhatsApp } from '../../lib/compradores-vip';

export function validarCasaOfrecida(body: Record<string, unknown> | null) {
  const texto = (valor: unknown) => typeof valor === 'string' ? valor.trim() : '';
  const nombre = texto(body?.nombre);
  const zona = texto(body?.zona);
  const condicion = texto(body?.condicion);
  const whatsapp = normalizarWhatsApp(body?.whatsapp, body?.pais);
  const plazo = texto(body?.plazo);
  const notas = texto(body?.notas);
  const fotos = texto(body?.fotos_url);
  const precio = body?.precio_esperado ?? null;
  const enlace = fotos && fotos.length <= 2048 && URL.canParse(fotos) ? new URL(fotos) : null;

  if (!nombre || nombre.length > 120 || !zona || zona.length > 120 || !whatsapp || !Object.hasOwn(condicionesCasa, condicion)) {
    throw new Error('Revisa el nombre, el WhatsApp, la zona y la condición de la casa.');
  }
  if (precio !== null && (typeof precio !== 'number' || precio <= 0 || precio >= 1e12 || !/^\d+(?:\.\d{1,2})?$/.test(String(precio)))) {
    throw new Error('Indica un precio positivo en USD con hasta dos decimales.');
  }
  if (plazo.length > 120 || notas.length > 1000 || (fotos && (!enlace || enlace.protocol !== 'https:' || enlace.username || enlace.password))) {
    throw new Error('Revisa la longitud del plazo y las notas. Usa un enlace HTTPS para las fotos.');
  }

  return {
    nombre, whatsapp, zona, condicion, precio_esperado: precio, plazo: plazo || null,
    fotos_url: enlace?.href ?? null, notas: notas || null,
  };
}
