// Sólo campos permitidos. Los errores de proveedores pueden contener datos personales.
export function registrarFallo(operacion: string, causa?: unknown) {
  const incidente = crypto.randomUUID();
  const codigo = causa && typeof causa === 'object' && 'code' in causa
    && typeof causa.code === 'string' && /^[A-Za-z0-9_]{1,24}$/.test(causa.code) ? causa.code : 'SIN_CODIGO';
  const estado = causa && typeof causa === 'object' && 'status' in causa
    && typeof causa.status === 'number' && causa.status >= 100 && causa.status <= 599 ? causa.status : undefined;
  console.error(JSON.stringify({ nivel: 'error', operacion, incidente, codigo, estado }));
  return incidente;
}

export function respuestaFallo(operacion: string, causa?: unknown, mensaje = 'No se pudo completar la operación.', status = 503) {
  const incidente = registrarFallo(operacion, causa);
  return Response.json({ error: `${mensaje} Referencia ${incidente}.`, incidente }, {
    status, headers: { 'Cache-Control': 'no-store', 'X-Incidente': incidente },
  });
}

export function registrarAviso(operacion: string, codigo: string, detalles?: { modelo: string; estado?: number }) {
  console.warn(JSON.stringify({ nivel: 'aviso', operacion, codigo, ...detalles }));
}
