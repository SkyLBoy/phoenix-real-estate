function texto(value: unknown) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string') throw new Error('Hay campos de texto inválidos');
  return value.trim() || null;
}

function numero(value: unknown) {
  if (value == null || (typeof value === 'string' && !value.trim())) return null;
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new Error('Hay campos numéricos inválidos');
  }
  const result = Number(value);
  if (!Number.isFinite(result) || result < 0) throw new Error('Hay campos numéricos inválidos');
  return result;
}

export function urlPublica(value: unknown) {
  const result = texto(value);
  if (!result) return null;
  try {
    const url = new URL(result);
    if (!/^https?:\/\/[^\s]+$/i.test(result) || url.username || url.password) {
      throw new Error();
    }
  } catch {
    throw new Error('Usa un enlace HTTP o HTTPS válido');
  }
  return result;
}

export function camposFicha(body: Record<string, unknown>) {
  return {
    direccion_privada: texto(body.direccion_privada),
    ciudad_zona: texto(body.ciudad_zona),
    precio: numero(body.precio),
    arv: numero(body.arv),
    beds: numero(body.beds),
    baths: numero(body.baths),
    sqft: numero(body.sqft),
    lot_size: texto(body.lot_size),
    year_built: numero(body.year_built),
    drive_url: urlPublica(body.drive_url),
    imagen_portada: urlPublica(body.imagen_portada),
    notas_extra: texto(body.notas_extra),
  };
}
