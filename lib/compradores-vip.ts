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

export function normalizarWhatsApp(valor: unknown) {
  if (typeof valor !== 'string' || valor.length > 40) return null;
  const numero = valor.trim().replace(/[\s().-]/g, '');
  if (/^\+[1-9][0-9]{7,14}$/.test(numero)) return numero;
  if (/^[0-9]{10}$/.test(numero)) return `+1${numero}`;
  if (/^1[0-9]{10}$/.test(numero)) return `+${numero}`;
  return null;
}

export function chatComprador(numero: unknown) {
  const whatsapp = normalizarWhatsApp(numero);
  return whatsapp ? `https://wa.me/${whatsapp.slice(1)}` : null;
}
