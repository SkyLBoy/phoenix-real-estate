/** Número internacional que el operador configuró para el botón público. */
export function numeroWhatsAppAsesor() {
  const configurado = process.env.NEXT_PUBLIC_WHATSAPP_ASESOR?.trim();
  const numero = configurado?.replace(/^\+/, '');
  if (!numero || !/^[1-9]\d{7,14}$/.test(numero) || numero === '16025550199') return null;
  if (numero.length === 10 && !configurado.startsWith('+')) return null;
  if (numero.startsWith('1') && numero.length !== 11) return null;
  if (numero.startsWith('52') && !/^52(?:1)?\d{10}$/.test(numero)) return null;
  return numero;
}
