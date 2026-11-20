export const perfilesVip = {
  familia_vivienda: 'Busca casa para vivir',
  inversionista: 'Inversionista',
} as const;

export type PerfilVip = keyof typeof perfilesVip;
export interface CompradorVip {
  id: string | number;
  nombre: string;
  whatsapp: string;
  perfil: PerfilVip;
  tiene_itin: boolean;
}

export const paisesWhatsApp = {
  MX: { etiqueta: '🇲🇽 México (+52)', prefijo: '+52' },
  US: { etiqueta: '🇺🇸 Estados Unidos (+1)', prefijo: '+1' },
} as const;

export type PaisWhatsApp = keyof typeof paisesWhatsApp;

export function normalizarWhatsApp(valor: unknown, pais?: unknown) {
  if (typeof valor !== 'string' || valor.length > 40) return null;
  const numero = valor.trim().replace(/[\s().-]/g, '');
  const seleccionado = pais === 'MX' || pais === 'US' ? pais : null;

  if (/^[0-9]{10}$/.test(numero)) {
    return seleccionado ? `${paisesWhatsApp[seleccionado].prefijo}${numero}` : null;
  }

  const mexico = numero.match(/^\+?52(?:1)?([0-9]{10})$/);
  if (mexico) return seleccionado === 'US' ? null : `+52${mexico[1]}`;
  const estadosUnidos = numero.match(/^\+?1([0-9]{10})$/);
  if (estadosUnidos) return seleccionado === 'MX' ? null : `+1${estadosUnidos[1]}`;
  return !seleccionado && /^\+[1-9][0-9]{7,14}$/.test(numero) ? numero : null;
}

export function chatComprador(valor: unknown) {
  const whatsapp = normalizarWhatsApp(valor);
  if (!whatsapp) return null;
  // WhatsApp usa el prefijo 521 para los contactos de México.
  const numero = /^\+52[0-9]{10}$/.test(whatsapp) ? `521${whatsapp.slice(3)}` : whatsapp.slice(1);
  return `https://wa.me/${numero}`;
}
