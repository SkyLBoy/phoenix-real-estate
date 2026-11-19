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
process.env.GOOGLE_DRIVE_API_KEY = 'drive-test-key';
process.env.ADMIN_PIN = 'pin-anterior';

const seller = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const technician = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const outsider = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
process.env.ADMIN_USER_IDS = `${seller}, ${technician}`;

const properties = new Map();
const serviceCalls = [];
const fotoDrive = { id: 'foto-1', name: 'Sala.jpg', resourceKey: 'clave-foto' };
const carpetaDrive = 'https://drive.google.com/drive/folders/carpeta-1?resourcekey=clave-carpeta';
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

  if (url.hostname === 'drive.google.com' && url.pathname === '/embeddedfolderview') {
    if (url.searchParams.get('id') === 'restringida') return new Response(null, { status: 403 });
    if (url.searchParams.get('id') === 'formato-distinto') return new Response('<html><body>Drive</body></html>');
    assert.equal(url.searchParams.get('id'), 'carpeta-1');
    assert.equal(url.searchParams.get('resourcekey'), 'clave-carpeta');
    assert.equal(request.redirect, 'manual');
    return new Response(`<div class="flip-entries">
      <div class="flip-entry" id="entry-foto-1">
        <a href="https://drive.google.com/file/d/foto-1/view?usp=drive_web&amp;resourcekey=clave-foto">
          <div class="flip-entry-list-icon"><img src="https://drive-thirdparty.googleusercontent.com/16/type/image/jpeg" /></div>
          <div class="flip-entry-title">Sala &amp; patio.JPG</div>
        </a>
      </div>
      <div class="flip-entry"><a href="/file/d/foto-2/view">
        <div class="flip-entry-title">Fachada.PNG</div>
      </a></div>
      <div class="flip-entry"><a href="/drive/folders/subcarpeta"><div class="flip-entry-title">Lote.jpg</div></a></div>
      <div class="flip-entry"><a href="https://otro.test/file/d/foto-3/view"><div class="flip-entry-title">Ajena.jpg</div></a></div>
      <div class="flip-entry"><a href="/file/d/documento/view">
        <div class="flip-entry-list-icon"><img src="https://drive-thirdparty.googleusercontent.com/16/type/application/pdf" /></div>
        <div class="flip-entry-title">Falso.jpg</div>
      </a></div>
    </div>`);
  }

  if (url.hostname === 'www.googleapis.com') {
    assert.equal(url.searchParams.get('key'), 'drive-test-key');
    if (url.pathname === '/drive/v3/files/foto-1' && url.searchParams.get('alt') === 'media') {
      assert.equal(request.headers.get('x-goog-drive-resource-keys'), 'foto-1/clave-foto');
      return new Response('foto de prueba', { headers: { 'Content-Type': 'image/jpeg' } });
    }
    assert.equal(request.headers.get('x-goog-drive-resource-keys'), 'carpeta-1/clave-carpeta');
    if (url.pathname === '/drive/v3/files/carpeta-1') {
      return Response.json({ mimeType: 'application/vnd.google-apps.folder' });
    }
    if (url.pathname === '/drive/v3/files') {
      assert.match(url.searchParams.get('q'), /'carpeta-1' in parents/);
      if (!url.searchParams.has('pageToken')) {
        return Response.json({ nextPageToken: 'p2', files: [
          { id: 'svg', name: 'SVG', mimeType: 'image/svg+xml' },
          { id: 'no-descarga', name: 'No.jpg', mimeType: 'image/jpeg', capabilities: { canDownload: false } },
        ] });
      }
      assert.equal(url.searchParams.get('pageToken'), 'p2');
      return Response.json({ files: [{ ...fotoDrive, mimeType: 'image/jpeg' }] });
    }
  }

  if (url.hostname === 'supabase.test' && url.pathname === '/auth/v1/user') {
    const id = request.headers.get('authorization')?.match(/^Bearer (.*)$/)?.[1];
    if ([seller, technician, outsider].includes(id)) return Response.json({ id });
    return Response.json({ message: 'Invalid token' }, { status: 401 });
  }

  if (url.hostname === 'supabase.test' && url.pathname === '/rest/v1/propiedades') {
    switch (request.method) {
      case 'GET': {
        if (url.searchParams.get('select') === 'fotos_drive,portada_drive_id') {
          assert.equal(url.searchParams.get('publicada_en'), 'not.is.null');
          assert.equal(url.searchParams.get('estado'), 'neq.vendida');
          const ficha = properties.get(url.searchParams.get('id').slice(3));
          return Response.json(ficha?.publicada_en && ficha.estado !== 'vendida' ? [ficha] : []);
        }
        return Response.json([...properties.values()]);
      }
      case 'POST': {
        const [body] = await request.json();
        const created = { ...body, id: 'casa-2', estado: 'disponible' };
        properties.set(created.id, created);
        return Response.json(created);
      }
      case 'PATCH': {
        const id = url.searchParams.get('id').slice(3);
        const existing = properties.get(id);
        const filters = ['imagen_portada', 'drive_url', 'portada_drive_id'];
        if (!existing || (url.searchParams.has('publicada_en') && existing.publicada_en !== null)
          || filters.some((field) => {
            const filter = url.searchParams.get(field);
            return filter === 'is.null' ? existing[field] !== null
              : filter !== null && existing[field] !== filter.slice(3);
          })) return Response.json([]);

        const changes = await request.json();
        if (changes.publicada_en && (!existing.ciudad_zona || !(existing.precio > 0))) {
          return Response.json({ code: '23514' }, { status: 400 });
        }
        properties.set(id, { ...existing, ...changes });
        if (url.searchParams.has('select')) return Response.json([{ id }]);
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
const { GET: DRIVE } = await import('../app/api/admin/drive/route.ts');
const { GET: PORTADA } = await import('../app/api/propiedades/[id]/portada/route.ts');

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


test('el operador guarda, completa y publica un borrador con la portada que revisó', async () => {
  const start = serviceCalls.length;
  const creation = await request(POST, 'POST', { token: seller, body: {
    direccion_privada: '123 Test St',
    notas_extra: 'Información para completar la ficha',
    generar_anuncios: false,
  } });
  assert.equal(creation.status, 200);
  assert.deepEqual(serviceCalls.slice(start), ['/auth/v1/user', '/rest/v1/propiedades']);
  const { propiedad: draft } = await creation.json();
  assert.equal(draft.publicada_en, null);
  assert.equal(draft.precio, null);

  const cover = 'https://images.test/casa.jpg';
  const folder = 'https://drive.google.com/drive/folders/test';
  function patch(body) {
    return request(PATCH, 'PATCH', { token: seller, body: { id: draft.id, ...body } });
  }
  function save(ficha) {
    return patch({ accion: 'guardar_borrador', ficha });
  }
  function publish(portada_revisada, carpeta_revisada = folder) {
    return patch({ accion: 'publicar', portada_revisada, carpeta_revisada });
  }

  assert.equal((await publish(null)).status, 400);
  assert.equal((await save({ imagen_portada: cover, drive_url: folder })).status, 200);
  assert.equal((await publish(cover)).status, 400);

  assert.equal((await save({
    ciudad_zona: 'Phoenix 85035', precio: 123000, imagen_portada: cover, drive_url: folder,
  })).status, 200);
  assert.equal((await publish('https://images.test/otra.jpg')).status, 409);
  assert.equal((await publish(cover, 'https://drive.google.com/drive/folders/otra')).status, 409);
  assert.equal((await publish(cover)).status, 200);
  assert.equal((await publish(cover)).status, 409);
  assert.equal((await save({ ciudad_zona: 'Otro valor' })).status, 409);

  const inventory = await (await request(GET, 'GET', { token: seller })).json();
  const published = inventory.propiedades.find(({ id }) => id === draft.id);
  assert.equal(published.ciudad_zona, 'Phoenix 85035');
  assert.equal(published.precio, 123000);
  assert.ok(Number.isFinite(Date.parse(published.publicada_en)));
  assert.equal(published.ultima_confirmacion, published.publicada_en);
});


test('el bloque bilingüe se convierte en una ficha corregible y se guarda como borrador', async () => {
  const { leerDatosPegados } = await import('../app/admin/datos-pegados.ts');
  const { valores, revisar, arvConMas } = leerDatosPegados([
    'Casa habitable en Phoenix',
    'Price: $296,000',
    'ARV: $399,999+',
    'Beds: 3',
    'Baths: 2.5',
    'Sq Ft: 1,838',
    'Lot Size: 9,326 Sq Ft',
    'Year Built: 1976',
    '📍 Ciudad: Phoenix',
    'ZIP: 85035',
  ].join('\r\n'));
  assert.deepEqual(valores, {
    precio: '296000', arv: '399999', beds: '3', baths: '2.5', sqft: '1838',
    lotSize: '9,326 Sq Ft', yearBuilt: '1976', ciudadZona: 'Phoenix, 85035',
  });
  assert.deepEqual(revisar, []);
  assert.equal(arvConMas, true);

  const creation = await request(POST, 'POST', { token: seller, body: {
    ciudad_zona: valores.ciudadZona,
    precio: '295000',
    arv: valores.arv,
    beds: valores.beds,
    baths: valores.baths,
    sqft: valores.sqft,
    lot_size: valores.lotSize,
    year_built: valores.yearBuilt,
    generar_anuncios: false,
  } });
  assert.equal(creation.status, 200);
  const { propiedad } = await creation.json();
  assert.equal(propiedad.publicada_en, null);
  const { propiedades } = await (await request(GET, 'GET', { token: seller })).json();
  const guardada = propiedades.find(({ id }) => id === propiedad.id);
  assert.equal(guardada.precio, 295000);
  assert.equal(guardada.ciudad_zona, 'Phoenix, 85035');
  assert.equal(guardada.direccion_privada, null);
  assert.equal(guardada.imagen_portada, null);
});

test('el pegado separa la dirección privada y marca importes ambiguos sin rellenarlos', async () => {
  const { leerDatosPegados } = await import('../app/admin/datos-pegados.ts');
  const resultado = leerDatosPegados([
    'Dirección exacta: 123 W Test St, Phoenix AZ 85035',
    'Precio: $200,000 a $220,000',
    'ARV: $300,000',
    'ARV estimado: $310,000',
    'Recámaras: 3',
    'Baños: 2',
  ].join('\n'));
  assert.deepEqual(resultado.valores, {
    direccionPrivada: '123 W Test St, Phoenix AZ 85035', beds: '3', baths: '2',
  });
  assert.deepEqual(resultado.revisar, ['precio', 'arv']);
});


test('Drive lista fotos compatibles, guarda la selección y sirve la portada solo tras publicar', async () => {
  function drive(params, token) {
    return DRIVE(new Request(`https://panel.test/api/admin/drive?${new URLSearchParams(params)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }));
  }

  const start = serviceCalls.length;
  assert.equal((await drive({ carpeta: carpetaDrive })).status, 401);
  assert.deepEqual(serviceCalls.slice(start), []);
  assert.equal((await drive({ carpeta: 'https://otro.test/drive/folders/carpeta-1' }, seller)).status, 400);
  const listado = await drive({ carpeta: carpetaDrive }, seller);
  assert.equal(listado.status, 200);
  assert.deepEqual(await listado.json(), { fotos: [fotoDrive] });

  const descarga = await drive({ foto: fotoDrive.id, clave: fotoDrive.resourceKey }, seller);
  assert.equal(descarga.headers.get('content-type'), 'image/jpeg');
  assert.equal(await descarga.text(), 'foto de prueba');

  const ficha = { ciudad_zona: 'Phoenix', precio: 250000, drive_url: carpetaDrive, generar_anuncios: false };
  const externa = await request(POST, 'POST', { token: seller, body: {
    ...ficha, fotos_drive_ids: ['externa'], portada_drive_id: 'externa',
  } });
  assert.equal(externa.status, 400);

  const guardado = await request(POST, 'POST', { token: seller, body: {
    ...ficha, fotos_drive_ids: [fotoDrive.id], portada_drive_id: fotoDrive.id,
  } });
  assert.equal(guardado.status, 200);
  const { propiedad } = await guardado.json();
  assert.deepEqual(propiedad.fotos_drive, [fotoDrive]);
  assert.equal(propiedad.portada_drive_id, fotoDrive.id);
  assert.equal(propiedad.imagen_portada, null);

  function portadaPublica() {
    return PORTADA(new Request('https://panel.test/api/propiedades/casa-2/portada'), {
      params: Promise.resolve({ id: propiedad.id }),
    });
  }
  assert.equal((await portadaPublica()).status, 404);

  const publicacion = await request(PATCH, 'PATCH', { token: seller, body: {
    id: propiedad.id, accion: 'publicar', portada_drive_revisada: fotoDrive.id, carpeta_revisada: carpetaDrive,
  } });
  assert.equal(publicacion.status, 200);
  const portada = await portadaPublica();
  assert.equal(portada.status, 200);
  assert.equal(await portada.text(), 'foto de prueba');
});


test('sin clave, el panel lee Drive público y conserva las descargas y portadas directas', async () => {
  const clave = process.env.GOOGLE_DRIVE_API_KEY;
  delete process.env.GOOGLE_DRIVE_API_KEY;
  try {
    const listar = (carpeta) => DRIVE(new Request(
      `https://panel.test/api/admin/drive?${new URLSearchParams({ carpeta })}`,
      { headers: { Authorization: `Bearer ${seller}` } },
    ));
    const embebido = 'https://drive.google.com/embeddedfolderview?id=carpeta-1&resourcekey=clave-carpeta#grid';
    const resultado = await listar(embebido);
    assert.equal(resultado.status, 200);
    const { fotos } = await resultado.json();
    assert.deepEqual(fotos, [
      {
        id: 'foto-1', name: 'Sala & patio.JPG', resourceKey: 'clave-foto',
        miniaturaUrl: 'https://lh3.googleusercontent.com/d/foto-1?resourcekey=clave-foto',
        descargaUrl: 'https://drive.google.com/uc?export=download&id=foto-1&resourcekey=clave-foto',
      },
      {
        id: 'foto-2', name: 'Fachada.PNG',
        miniaturaUrl: 'https://lh3.googleusercontent.com/d/foto-2',
        descargaUrl: 'https://drive.google.com/uc?export=download&id=foto-2',
      },
    ]);
    assert.deepEqual(await (await listar(carpetaDrive)).json(), { fotos });
    assert.equal((await listar('https://drive.google.com/drive/folders/restringida')).status, 422);
    assert.equal((await listar('https://drive.google.com/drive/folders/formato-distinto')).status, 422);

    const guardado = await request(POST, 'POST', { token: seller, body: {
      ciudad_zona: 'Phoenix', precio: 250000, drive_url: embebido,
      generar_anuncios: false, fotos_drive_ids: ['foto-2'], portada_drive_id: 'foto-2',
    } });
    assert.equal(guardado.status, 200);
    const { propiedad } = await guardado.json();
    assert.deepEqual(propiedad.fotos_drive, [{ id: 'foto-2', name: 'Fachada.PNG' }]);
    const inventario = await request(GET, 'GET', { token: seller });
    assert.deepEqual((await inventario.json()).propiedades.find(({ id }) => id === propiedad.id).fotos_drive, [fotos[1]]);

    const portada = () => PORTADA(new Request('https://panel.test/api/propiedades/casa-2/portada'), {
      params: Promise.resolve({ id: propiedad.id }),
    });
    assert.equal((await portada()).status, 404);
    const publicado = await request(PATCH, 'PATCH', { token: seller, body: {
      id: propiedad.id, accion: 'publicar', portada_drive_revisada: 'foto-2', carpeta_revisada: embebido,
    } });
    assert.equal(publicado.status, 200);
    const respuesta = await portada();
    assert.equal(respuesta.status, 302);
    assert.equal(respuesta.headers.get('location'), fotos[1].miniaturaUrl);
  } finally {
    process.env.GOOGLE_DRIVE_API_KEY = clave;
  }
});
