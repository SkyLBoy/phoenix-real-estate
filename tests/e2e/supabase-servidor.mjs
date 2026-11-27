const buscar = globalThis.fetch;
const ficha = {
  id: 'ficha-servidor',
  ciudad_zona: 'Peoria, AZ 85345',
  precio: 292000,
  estado: 'disponible',
  ultima_confirmacion: '2026-01-01T00:00:00.000Z',
  tiene_portada_drive: true,
};
const retirada = { ...ficha, id: 'ficha-retirada', estado: 'vendida' };
const similar = { ...ficha, id: 'ficha-similar', ultima_confirmacion: new Date().toISOString(), tiene_portada_drive: false };
const foto = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const bytes = Buffer.from('524946462e0000005745425056503820220000007001009d012a010001000140262594027401400000fef7b41d25d2e42ec9de200000', 'hex');
const hash = 'a'.repeat(64);

globalThis.fetch = (entrada, opciones) => {
  const url = new URL(entrada instanceof Request ? entrada.url : entrada);
  if (url.hostname !== 'supabase.test') return buscar(entrada, opciones);
  const id = url.searchParams.get('id');
  if (url.pathname === '/rest/v1/propiedades' && id === `eq.${ficha.id}`) {
    return Promise.resolve(Response.json([{ portada_publica_id: foto, galeria_publica_ids: [foto] }]));
  }
  if (url.pathname === '/rest/v1/material_publico' && id === `eq.${foto}`) {
    return Promise.resolve(Response.json([{ contenido_hash: hash, contenido: `\\x${bytes.toString('hex')}` }]));
  }
  if (url.pathname !== '/rest/v1/propiedades_publicas') {
    return Promise.resolve(Response.json({ code: 'RUTA_INESPERADA' }, { status: 500 }));
  }
  if (id?.startsWith('eq.')) {
    const filas = [ficha, retirada, similar].filter((propiedad) => `eq.${propiedad.id}` === id);
    return Promise.resolve(Response.json(filas));
  }
  if (url.searchParams.get('select') === 'id,ciudad_zona,precio') {
    return Promise.resolve(Response.json([similar]));
  }
  const filas = url.searchParams.get('select') === 'precio' ? [{ precio: ficha.precio }] : [ficha];
  return Promise.resolve(Response.json(filas, { headers: { 'Content-Range': '0-0/1' } }));
};
