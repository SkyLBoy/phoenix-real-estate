import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'next/server') {
      return nextResolve('next/server.js', context);
    }
    if (specifier.startsWith('.') && context.parentURL?.endsWith('.ts')) {
      const source = new URL(specifier + '.ts', context.parentURL);
      if (existsSync(fileURLToPath(source))) return nextResolve(source.href, context);
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (!url.endsWith('.ts')) return nextLoad(url, context);
    const { outputText } = ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    });
    return { format: 'module', source: outputText, shortCircuit: true };
  },
});

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://supabase.test';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
process.env.GEMINI_API_KEY = 'gemini-test-key';
process.env.ADMIN_PIN = 'pin-anterior';

const seller = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const technician = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const outsider = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
process.env.ADMIN_USER_IDS = `${seller}, ${technician}`;

const properties = new Map();
const serviceCalls = [];
const property = { id: 'casa-1', ciudad_zona: 'Phoenix', estado: 'disponible' };
const scripts = {
  script_fb_es: 'Anuncio de prueba',
  script_fb_en: 'Test listing',
  script_wa_vip: 'Aviso de prueba',
  script_filtro_curiosos: 'Respuesta de prueba',
};

globalThis.fetch = async (input, init) => {
  const request = new Request(input, init);
  const url = new URL(request.url);
  serviceCalls.push(url.pathname);

  if (url.hostname === 'generativelanguage.googleapis.com') {
    return Response.json({
      candidates: [{ content: { parts: [{ text: JSON.stringify(scripts) }] } }],
    });
  }

  if (url.hostname === 'supabase.test' && url.pathname === '/auth/v1/user') {
    const id = request.headers.get('authorization')?.match(/^Bearer (.*)$/)?.[1];
    if ([seller, technician, outsider].includes(id)) return Response.json({ id });
    return Response.json({ message: 'Invalid token' }, { status: 401 });
  }

  if (url.hostname === 'supabase.test' && url.pathname === '/rest/v1/propiedades') {
    switch (request.method) {
      case 'GET':
        return Response.json([...properties.values()]);
      case 'POST': {
        const [body] = await request.json();
        const created = { ...body, id: 'casa-2', estado: 'disponible' };
        properties.set(created.id, created);
        return Response.json(created);
      }
      case 'PATCH': {
        const id = url.searchParams.get('id').slice(3);
        properties.set(id, { ...properties.get(id), ...(await request.json()) });
        return new Response(null, { status: 204 });
      }
      case 'DELETE':
        properties.delete(url.searchParams.get('id').slice(3));
        return new Response(null, { status: 204 });
    }
  }

  throw new Error(`Solicitud inesperada: ${request.method} ${url}`);
};

const { GET, PATCH, DELETE } = await import('../app/api/admin/propiedades/route.ts');
const { POST } = await import('../app/api/procesar-propiedad/route.ts');

function request(handler, method, { token, query = '', body } = {}) {
  const path = method === 'POST' ? '/api/procesar-propiedad' : '/api/admin/propiedades';
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return handler(new Request(`https://panel.test${path}${query}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  }));
}

test('las rutas privadas rechazan el PIN anterior y requieren una sesión', async () => {
  const start = serviceCalls.length;
  assert.equal((await request(GET, 'GET', { query: '?pin=pin-anterior' })).status, 401);
  assert.equal((await request(PATCH, 'PATCH', { body: { pin: 'pin-anterior', id: property.id, estado: 'vendida' } })).status, 401);
  assert.equal((await request(DELETE, 'DELETE', { query: '?pin=pin-anterior&id=casa-1' })).status, 401);
  assert.equal((await request(POST, 'POST', { body: { pin: 'pin-anterior' } })).status, 401);
  assert.deepEqual(serviceCalls.slice(start), []);
});

for (const [description, token, status] of [
  ['token inválido', 'invalid-token', 401],
  ['cuenta sin autorización', outsider, 403],
]) {
  test(`todas las operaciones privadas rechazan ${description} antes de procesar la solicitud`, async () => {
    const start = serviceCalls.length;
    assert.equal((await request(GET, 'GET', { token })).status, status);
    assert.equal((await request(PATCH, 'PATCH', { token })).status, status);
    assert.equal((await request(DELETE, 'DELETE', { token })).status, status);
    assert.equal((await request(POST, 'POST', { token })).status, status);
    assert.deepEqual(serviceCalls.slice(start), Array(4).fill('/auth/v1/user'));
  });
}

test('el vendedor administra el inventario y el técnico puede consultarlo con su cuenta', async () => {
  properties.set(property.id, property);

  const listing = await request(GET, 'GET', { token: seller });
  assert.deepEqual(await listing.json(), { propiedades: [property] });
  assert.match(listing.headers.get('cache-control'), /no-store/);

  const creation = await request(POST, 'POST', {
    token: seller,
    body: { ciudad_zona: 'Mesa', precio: 225000, direccion_privada: '123 Test St' },
  });
  assert.equal(creation.status, 200);
  const { propiedad: created } = await creation.json();
  assert.equal(created.ciudad_zona, 'Mesa');

  const changed = await request(PATCH, 'PATCH', {
    token: seller,
    body: { id: created.id, estado: 'en_contrato' },
  });
  assert.equal(changed.status, 200);

  const technicianListing = await request(GET, 'GET', { token: technician });
  const inventory = (await technicianListing.json()).propiedades;
  assert.equal(inventory.find(({ id }) => id === created.id).estado, 'en_contrato');

  const deleted = await request(DELETE, 'DELETE', { token: seller, query: `?id=${created.id}` });
  assert.equal(deleted.status, 200);
  const finalListing = await request(GET, 'GET', { token: seller });
  assert.deepEqual(await finalListing.json(), { propiedades: [property] });
});

test('si falta la lista de acceso, la cuenta válida no obtiene acceso', async () => {
  const allowed = process.env.ADMIN_USER_IDS;
  delete process.env.ADMIN_USER_IDS;
  try {
    assert.equal((await request(GET, 'GET', { token: seller })).status, 403);
  } finally {
    process.env.ADMIN_USER_IDS = allowed;
  }
});
