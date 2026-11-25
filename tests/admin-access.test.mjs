import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import sharp from 'sharp';
import { unzipSync } from 'fflate';

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
const materiales = new Map();
const ofertas = new Map();
const compradores = [];
const serviceCalls = [];
const entradasGemini = [];
let simularGeminiInvalido = false;
let respuestaGeminiDePrueba;
const fotoDrive = { id: 'foto-1', name: 'Sala.jpg', resourceKey: 'clave-foto' };
const fotoJpeg = await sharp({ create: { width: 1700, height: 850, channels: 3, background: 'tan' } }).jpeg().toBuffer();
const fotoPng = await sharp({ create: { width: 80, height: 60, channels: 3, background: 'blue' } }).png().toBuffer();
let driveSinAcceso = false;
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

  if (url.hostname === 'supabase.test' && url.pathname === '/rest/v1/rpc/reservar_material') {
    const { propiedad, version, origen } = await request.json();
    const ficha = properties.get(propiedad);
    if (!ficha || (ficha.ficha_version ?? 0) !== version) return Response.json([]);
    const anterior = [...materiales.values()].find((m) => m.propiedad_id === propiedad && m.ficha_version === version && m.fuente === origen);
    if (anterior && !anterior.contenido_hash && (!anterior.vence || Date.parse(anterior.vence) > Date.now())) return Response.json([]);
    const id = crypto.randomUUID();
    const token = crypto.randomUUID();
    materiales.set(id, { id,token,propiedad_id:propiedad,ficha_version:version,fuente:origen,vence:new Date(Date.now()+90000).toISOString() });
    return Response.json([{ id, token }]);
  }
  if (url.hostname === 'supabase.test' && url.pathname === '/rest/v1/material_publico') {
    const filtros = [...url.searchParams].filter(([campo]) => campo !== 'select');
    const rows = [...materiales.values()].filter((fila) => filtros.every(([campo, valor]) => valor === 'is.null' ? fila[campo] == null : String(fila[campo]) === valor.slice(3)));
    if (request.method === 'PATCH') {
      const cambios = await request.json();
      for (const fila of rows) Object.assign(fila, cambios);
    }
    return Response.json(rows);
  }

  if (url.hostname === 'supabase.test' && url.pathname === '/rest/v1/rpc/registrar_envio_publico') {
    assert.equal(request.headers.get('authorization'), 'Bearer service-role-key');
    const { canal, datos } = await request.json();
    if (canal === 'vip') compradores.unshift({ id: compradores.length + 1, ...datos });
    else {
      const id = 'edee7d66-8832-40a5-9418-f47ab7190133';
      ofertas.set(id, { ...datos, id, estado: 'nueva' });
    }
    return Response.json('registrado');
  }

  if (url.hostname === 'generativelanguage.googleapis.com') {
    entradasGemini.push(await request.text());
    const respuesta = respuestaGeminiDePrueba ?? (simularGeminiInvalido ? { script_fb_es: 'Incompleto' } : scripts);
    return Response.json({
      candidates: [{ content: { parts: [{ text: JSON.stringify(respuesta) }] } }],
    });
  }

  if (url.hostname === 'drive.google.com' && url.pathname.startsWith('/drive/folders/')) {
    if (url.pathname.endsWith('/restringida')) return new Response(null, { status: 403 });
    if (url.pathname.endsWith('/formato-distinto')) return new Response('<html><body>Drive</body></html>');
    assert.equal(url.pathname, '/drive/folders/carpeta-alterna');
    assert.equal(url.searchParams.get('resourcekey'), 'clave-carpeta');
    const imagen = ['foto-lateral', ['carpeta-alterna'], "Patio d’entrada #1.JPG", 'image/jpeg'];
    imagen[114] = 'https://drive.google.com/file/d/foto-lateral/view?resourcekey=clave-lateral';
    const filas = [imagen, ['pdf-falso', ['carpeta-alterna'], 'Falso.jpg', 'application/pdf'],
      ['ajena', ['otra-carpeta'], 'Ajena.png', 'image/png']];
    const carga = JSON.stringify([filas]).replaceAll('"', '\\x22').replaceAll('[', '\\x5b').replaceAll(']', '\\x5d');
    return new Response(`<script>window['_DRIVE_ivd'] = '${carga}';</script>`);
  }

  if (url.hostname === 'drive.google.com' && url.pathname === '/embeddedfolderview') {
    if (url.searchParams.get('id') === 'carpeta-alterna') return new Response(null, { status: 403 });
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
        <div class="flip-entry-thumb"><img src="https://lh3.googleusercontent.com/drive-storage/miniatura-fachada=s190"></div>
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
      return new Response(fotoJpeg, { headers: { 'Content-Type': 'image/jpeg' } });
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

  if (url.hostname === 'drive.google.com' && (url.pathname === '/uc' || url.pathname === '/thumbnail')) {
    if (driveSinAcceso) return new Response(null, { status: 403 });
    if (url.searchParams.get('id') === 'foto-1') {
      assert.equal(url.searchParams.get('resourcekey'), 'clave-foto');
      return new Response(fotoJpeg, { headers: { 'Content-Type': 'application/octet-stream' } });
    }
    assert.equal(url.searchParams.get('id'), 'foto-2');
    return new Response(fotoPng, { headers: { 'Content-Type': 'image/png' } });
  }
  if (url.hostname === 'drive.usercontent.google.com') return new Response(null, { status: 403 });

  if (url.hostname === 'supabase.test' && url.pathname === '/auth/v1/user') {
    const id = request.headers.get('authorization')?.match(/^Bearer (.*)$/)?.[1];
    if ([seller, technician, outsider].includes(id)) return Response.json({ id });
    return Response.json({ message: 'Invalid token' }, { status: 401 });
  }

  if (url.hostname === 'supabase.test' && url.pathname === '/rest/v1/casas_ofrecidas') {
    assert.equal(request.headers.get('authorization'), 'Bearer service-role-key');
    if (request.method === 'POST') {
      const id = 'edee7d66-8832-40a5-9418-f47ab7190133';
      const casa = { ...await request.json(), id, estado: 'nueva' };
      ofertas.set(id, casa);
      return Response.json(casa);
    }
    if (request.method === 'PATCH') {
      const id = url.searchParams.get('id').slice(3);
      if (!ofertas.has(id)) return Response.json([]);
      const casa = { ...ofertas.get(id), ...await request.json() };
      ofertas.set(id, casa);
      return Response.json([casa]);
    }
    return Response.json([...ofertas.values()]);
  }

  if (url.hostname === 'supabase.test' && url.pathname === '/rest/v1/leads_compradores') {
    assert.equal(request.headers.get('authorization'), 'Bearer service-role-key');
    if (request.method === 'POST') {
      const comprador = await request.json();
      compradores.unshift({ id: compradores.length + 1, ...comprador });
      return new Response(null, { status: 201 });
    }
    assert.equal(url.searchParams.get('select'), 'id,nombre,whatsapp,perfil,tiene_itin');
    assert.equal(url.searchParams.get('order'), 'created_at.desc.nullslast,id.desc');
    const offset = Number(url.searchParams.get('offset'));
    return Response.json(compradores.slice(offset, offset + Number(url.searchParams.get('limit'))));
  }

  if (url.hostname === 'supabase.test' && url.pathname === '/rest/v1/propiedades_publicas') {
    assert.equal(request.headers.get('authorization'), 'Bearer anon-key');
    assert.equal(url.searchParams.get('estado'), 'eq.disponible');
    if (url.searchParams.get('select') === 'precio') {
      assert.equal(url.searchParams.get('order'), 'precio.asc');
      assert.equal(url.searchParams.get('limit'), '1');
      let filas = [...properties.values()].filter((p) => p.publicada_en && p.estado === 'disponible' && p.precio != null);
      const ciudad = url.searchParams.get('ciudad')?.slice(3);
      const zip = url.searchParams.get('zip')?.slice(5,-1);
      if (ciudad) filas = filas.filter((p) => p.ciudad === ciudad);
      if (zip) filas = filas.filter((p) => p.zip?.startsWith(zip));
      filas.sort((a,b) => a.precio-b.precio);
      return Response.json(filas.slice(0,1).map((p) => ({precio:p.precio})));
    }
    if (url.searchParams.get('select')?.startsWith('id,ciudad_zona,precio,arv')) {
      let filas = [...properties.values()].filter((p) => p.publicada_en && p.estado === 'disponible');
      const ciudad = url.searchParams.get('ciudad')?.slice(3);
      const zip = url.searchParams.get('zip')?.slice(5,-1);
      if (ciudad) filas = filas.filter((p) => p.ciudad === ciudad);
      if (zip) filas = filas.filter((p) => p.zip?.startsWith(zip));
      filas.sort((a,b) => b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id));
      const total = filas.length;
      const inicio = Number(url.searchParams.get('offset'));
      const limite = Number(url.searchParams.get('limit'));
      filas = filas.slice(inicio,inicio+limite);
      const campos = url.searchParams.get('select').split(',');
      return Response.json(filas.map((fila) => Object.fromEntries(campos.map((campo) => [campo,
        ['drive_url','imagen_portada'].includes(campo) ? null : fila[campo] ?? null]))), {
        headers: { 'Content-Range': `${inicio}-${inicio+filas.length-1}/${total}` },
      });
    }

    if (url.searchParams.get('select') === 'id,ciudad_zona,precio') {
      assert.equal(url.searchParams.get('or'), '(ciudad_zona.ilike."*peoria*",ciudad_zona.ilike."*85345*")');
      const excluida = url.searchParams.get('id').slice(4);
      const fechas = url.searchParams.get('ultima_confirmacion');
      assert.match(fechas, /^gt\./);
      return Response.json([...properties.values()].filter((ficha) => ficha.publicada_en
        && ficha.estado === 'disponible' && ficha.id !== excluida
        && ficha.ultima_confirmacion && ficha.ultima_confirmacion > fechas.slice(3))
        .map(({ id, ciudad_zona, precio }) => ({ id, ciudad_zona, precio })));
    }
    assert.equal(url.searchParams.get('order'), 'created_at.desc,id.asc');
    const campos = url.searchParams.get('select').split(',');
    assert.deepEqual(campos, ['ciudad_zona', 'precio', 'estado', 'ultima_confirmacion']);
    const inicio = Number(url.searchParams.get('offset'));
    const limite = Number(url.searchParams.get('limit'));
    return Response.json([...properties.values()]
      .filter((ficha) => ficha.publicada_en && ficha.estado === 'disponible')
      .slice(inicio, inicio + limite)
      .map((ficha) => Object.fromEntries(campos.map((campo) => [campo, ficha[campo] ?? null]))));
  }

  if (url.hostname === 'supabase.test' && url.pathname === '/rest/v1/propiedades') {
    switch (request.method) {
      case 'GET': {
        if (url.searchParams.get('select') === 'portada_publica_id,galeria_publica_ids,portada_legacy_hash' || ['galeria_publica_ids', 'galeria_publica_ids,portada_publica_id'].includes(url.searchParams.get('select'))) {
          assert.equal(url.searchParams.get('publicada_en'), 'not.is.null');
          assert.equal(url.searchParams.get('estado'), 'eq.disponible');
          const ficha = properties.get(url.searchParams.get('id').slice(3));
          return Response.json(ficha?.publicada_en && ficha.estado === 'disponible' ? [ficha] : []);
        }
        if (url.searchParams.get('select') === 'id,ciudad_zona,precio,arv,beds,baths,sqft,lot_size,year_built,drive_url,imagen_portada,estado,tiene_portada_drive,ultima_confirmacion') return Response.json([]);
        if (url.searchParams.has('id') && !url.searchParams.has('textos_version')) {
          const ficha = properties.get(url.searchParams.get('id').slice(3));
          if (!ficha || (url.searchParams.has('ficha_version') && String(ficha.ficha_version ?? 0) !== url.searchParams.get('ficha_version').slice(3))) return Response.json([]);
          if (url.searchParams.get('publicada_en') === 'is.null' && ficha.publicada_en != null) return Response.json([]);
          return Response.json([ficha]);
        }
        if (url.searchParams.has('textos_version')) {
          const ficha = properties.get(url.searchParams.get('id').slice(3));
          if (String(ficha?.textos_version) !== url.searchParams.get('textos_version').slice(3)) {
            return Response.json([]);
          }
          return Response.json([Object.fromEntries(url.searchParams.get('select').split(',')
            .map((campo) => [campo, ficha[campo] ?? null]))]);
        }
        const campos = url.searchParams.get('select').split(',');
        let fichas = [...properties.values()];
        if (url.searchParams.get('publicada_en') === 'is.null') {
          fichas = fichas.filter((ficha) => ficha.id === url.searchParams.get('id').slice(3) && ficha.publicada_en == null);
        }
        if (url.searchParams.has('or')) {
          assert.equal(url.searchParams.get('publicada_en'), 'not.is.null');
          assert.equal(url.searchParams.get('estado'), 'eq.disponible');
          assert.equal(url.searchParams.get('order'), 'revision_desde.asc,id.asc');
          const limite = Date.parse(url.searchParams.get('or').match(/^\(ultima_confirmacion\.is\.null,ultima_confirmacion\.lte\.(.+)\)$/)[1]);
          fichas = fichas.filter((ficha) => ficha.publicada_en && ficha.estado === 'disponible'
            && (!ficha.ultima_confirmacion || Date.parse(ficha.ultima_confirmacion) <= limite));
          fichas.sort((a, b) => Date.parse(a.ultima_confirmacion ?? a.publicada_en) - Date.parse(b.ultima_confirmacion ?? b.publicada_en)
            || a.id.localeCompare(b.id));
        }
        if (url.searchParams.has('limit')) {
          const inicio = Number(url.searchParams.get('offset'));
          fichas = fichas.slice(inicio, inicio + Number(url.searchParams.get('limit')));
        }
        return Response.json(fichas.map((ficha) => Object.fromEntries(campos.map((campo) => [campo, ficha[campo]]))));
      }
      case 'POST': {
        const [body] = await request.json();
        const created = { ficha_version: 0, ultima_confirmacion: null, ...body, id: 'casa-2', estado: 'disponible' };
        properties.set(created.id, created);
        return Response.json(created);
      }
      case 'PATCH': {
        const id = url.searchParams.get('id').slice(3);
        const existing = properties.get(id);
        const filtros = [...url.searchParams].filter(([campo]) => !['id', 'select', 'publicada_en'].includes(campo));
        const publicacion = url.searchParams.get('publicada_en');
        if (!existing || (publicacion === 'is.null' && existing.publicada_en !== null)
          || (publicacion === 'not.is.null' && existing.publicada_en == null)
          || filtros.some(([campo, filtro]) => filtro === 'is.null' ? existing[campo] != null
            : String(campo === 'ficha_version' ? existing[campo] ?? 0 : existing[campo]) !== filtro.slice(3))) return Response.json([]);

        const changes = await request.json();
        if (changes.publicada_en && (!existing.ciudad_zona || !(existing.precio > 0))) {
          return Response.json({ code: '23514' }, { status: 400 });
        }
        properties.set(id, { ...existing, ...changes, ficha_version: (existing.ficha_version ?? 0) + 1 });
        if (url.searchParams.has('select')) {
          return Response.json([Object.fromEntries(url.searchParams.get('select').split(',')
            .map((campo) => [campo, properties.get(id)[campo]]))]);
        }
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
const { POST: PREPARAR } = await import('../app/api/admin/material-publico/route.ts');
const { GET: PORTADA } = await import('../app/api/propiedades/[id]/portada/route.ts');

test('el contacto público conserva la referencia y nunca abre el WhatsApp de ejemplo', async () => {
  const { enlaceWhatsApp } = await import('../lib/propiedades-publicas.ts');
  const anterior = process.env.NEXT_PUBLIC_WHATSAPP_ASESOR;
  try {
    const prop = { id: 'ref-17', ciudad_zona: 'Peoria, AZ 85345', precio: 292000, estado: 'disponible' };
    delete process.env.NEXT_PUBLIC_WHATSAPP_ASESOR;
    assert.equal(enlaceWhatsApp(prop), null);
    for (const valor of ['16025550199', '6025550123', 'incorrecto']) {
      process.env.NEXT_PUBLIC_WHATSAPP_ASESOR = valor;
      assert.equal(enlaceWhatsApp(prop), null);
    }
    process.env.NEXT_PUBLIC_WHATSAPP_ASESOR = '+16025550120';
    assert.match(new URL(enlaceWhatsApp(prop)).searchParams.get('text'), /coordinar una visita/);
    for (const estado of ['en_contrato', 'vendida']) {
      const url = new URL(enlaceWhatsApp({ ...prop, estado }));
      assert.equal(url.pathname, '/16025550120');
      assert.match(url.searchParams.get('text'), /Peoria, AZ 85345 de \$292,000 USD \(ref\. ref-17\).*similar/);
    }
  } finally {
    if (anterior === undefined) delete process.env.NEXT_PUBLIC_WHATSAPP_ASESOR;
    else process.env.NEXT_PUBLIC_WHATSAPP_ASESOR = anterior;
  }
});

test('un enlace histórico sugiere hasta dos casas confirmadas por ZIP, ciudad y precio', async () => {
  const { cargarSimilares } = await import('../lib/propiedades-similares.ts');
  const ahora = Date.parse('2026-11-20T18:00:00Z');
  const ref = { id: 'anterior', ciudad_zona: 'Peoria, AZ 85345', precio: 290000 };
  const hoy = new Date(ahora).toISOString();
  const limite = new Date(ahora - 72 * 3600000).toISOString();
  const fichas = [
    ['mismo-zip', 'Peoria 85345', 304000], ['cercana', 'Peoria, AZ 85383', 291000],
    ['cara', 'Peoria', 450000], ['otra', 'East Peoria', 290000],
    ['pendiente', 'Peoria 85345', 290000, limite], ['nunca', 'Peoria 85345', 290000, null],
  ];
  try {
    for (const [id, ciudad_zona, precio, ultima_confirmacion = hoy] of fichas) {
      properties.set(id, { id, ciudad_zona, precio, ultima_confirmacion, publicada_en: hoy, estado: 'disponible' });
    }
    const similares = await cargarSimilares(ref, ahora);
    assert.deepEqual(similares.map(({ id }) => id), ['mismo-zip', 'cercana']);
    assert.deepEqual(await cargarSimilares({ ...ref, ciudad_zona: '123 N Main St' }, ahora), []);
  } finally {
    for (const [id] of fichas) properties.delete(id);
  }
});

async function request(handler, method, { token, query = '', body } = {}) {
  if (body && ['guardar_borrador', 'publicar'].includes(body.accion) && !Object.hasOwn(body, 'ficha_version')) {
    body = { ...body, ficha_version: properties.get(body.id)?.ficha_version ?? 0 };
  }
  if (body?.accion === 'publicar' && body.material_revisado === undefined && token === seller) {
    const ficha = properties.get(body.id);
    if (ficha && (ficha.portada_drive_id || ficha.imagen_portada)) {
      const fuente = ficha.portada_drive_id ?? 'portada-alternativa';
      const params = new URLSearchParams({ id:String(body.id), version:String(body.ficha_version), fuente });
      const respuesta = await PREPARAR(new Request(`https://panel.test/api/admin/material-publico?${params}`, {
        method:'POST',headers:{Authorization:`Bearer ${seller}`}, ...(fuente === 'portada-alternativa' ? { body:fotoJpeg } : {}),
      }));
      if (!respuesta.ok) return respuesta;
      const copia = await respuesta.json();
      body = { ...body, material_revisado:true, portada_publica_id:copia.id, galeria_publica_ids:[copia.id] };
    }
  }
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
    ciudad_zona: '4512 W McDowell Rd', precio: 123000, imagen_portada: cover, drive_url: folder,
  })).status, 200);
  assert.equal((await patch({ accion: 'publicar', zona_revisada: 'Phoenix',
    portada_revisada: cover, carpeta_revisada: folder })).status, 400);
  assert.equal(properties.get(draft.id).publicada_en, null);

  assert.equal((await save({
    ciudad_zona: 'Phoenix 85035', precio: 123000, imagen_portada: cover, drive_url: folder,
  })).status, 200);
  assert.equal((await publish('https://images.test/otra.jpg')).status, 409);
  assert.equal((await publish(cover, 'https://drive.google.com/drive/folders/otra')).status, 409);
  assert.equal((await patch({ accion: 'publicar', zona_revisada: 'Mesa',
    portada_revisada: cover, carpeta_revisada: folder })).status, 409);
  assert.equal((await publish(cover)).status, 200);
  assert.equal((await publish(cover)).status, 409);
  assert.equal((await save({ ciudad_zona: 'Otro valor' })).status, 409);

  const inventory = await (await request(GET, 'GET', { token: seller })).json();
  const published = inventory.propiedades.find(({ id }) => id === draft.id);
  assert.equal(published.ciudad_zona, 'Phoenix 85035');
  assert.equal(published.precio, 123000);
  assert.ok(Number.isFinite(Date.parse(published.publicada_en)));
  assert.equal(published.ultima_confirmacion, null);
});

test('publicar conserva la última verificación o registra la confirmación explícita del vendedor', async () => {
  const fecha = '2025-11-01T13:20:00Z';
  const portada = 'https://images.test/prueba.jpg';
  for (const confirmar of [false, true]) {
    const id = `borrador-confirmacion-${confirmar}`;
    properties.set(id, { id, estado: 'disponible', ciudad_zona: 'Peoria, AZ 85345', precio: 292000,
      imagen_portada: portada, publicada_en: null, ultima_confirmacion: fecha });
    const publicar = (valor) => request(PATCH, 'PATCH', { token: seller, body: {
      id, accion: 'publicar', portada_revisada: portada, zona_revisada: 'Peoria, AZ 85345', confirmar_disponibilidad: valor,
    } });
    assert.equal((await publicar('sí')).status, 400);
    assert.equal((await publicar(confirmar)).status, 200);
    const ficha = properties.get(id);
    assert.equal(ficha.ultima_confirmacion, confirmar ? ficha.publicada_en : fecha);
    properties.delete(id);
  }
});

test('la zona pública acepta localidades y ZIP y rechaza domicilios, unidades y cruces', async () => {
  const { esZonaPublica } = await import('../lib/zona-publica.ts');
  for (const zona of ['Peoria, AZ 85345', 'Peoria 85345', '85035', '85281-2000', 'St. Johns', 'San José', 'Tempe, 85281']) {
    assert.equal(esZonaPublica(zona), true, zona);
  }
  for (const zona of ['', null, '4512 W McDowell Rd', 'Phoenix Apt 4', 'Mesa #2', '7th Ave & Bell', '12345 W Bell Rd']) {
    assert.equal(esZonaPublica(zona), false, String(zona));
  }
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
  assert.deepEqual(Buffer.from(await descarga.arrayBuffer()), fotoJpeg);

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
  const consultasTrasPublicar = serviceCalls.length;
  const portada = await portadaPublica();
  assert.equal(portada.status, 200);
  assert.equal(portada.headers.get('content-type'), 'image/webp');
  const metadata = await sharp(Buffer.from(await portada.arrayBuffer())).metadata();
  assert.equal(metadata.width, 1600);
  assert.equal(metadata.height, 800);
  assert.ok(serviceCalls.slice(consultasTrasPublicar).every((ruta) => !ruta.includes('/drive/')));
});


test('sin clave, Drive público entrega originales seleccionados en un ZIP y conserva la portada tras publicar', async () => {
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
        miniaturaDrive: 'https://lh3.googleusercontent.com/drive-storage/miniatura-fachada=s190',
        miniaturaUrl: 'https://lh3.googleusercontent.com/d/foto-2',
        descargaUrl: 'https://drive.google.com/uc?export=download&id=foto-2',
      },
    ]);
    assert.deepEqual(await (await listar(carpetaDrive)).json(), { fotos });
    const { crearZipFotos } = await import('../lib/zip-fotos.ts');
    const descargar = (foto, token) => DRIVE(new Request(
      'https://panel.test/api/admin/drive?' + new URLSearchParams({
        foto: foto.id, original: '1', ...(foto.resourceKey ? { clave: foto.resourceKey } : {}),
      }),
      { headers: token ? { Authorization: `Bearer ${token}` } : {} },
    ));
    assert.equal((await descargar(fotos[0])).status, 401);
    const progreso = [];
    const zip = await crearZipFotos(fotos, async (foto) => {
      const respuesta = await descargar(foto, seller);
      assert.equal(respuesta.status, 200);
      return respuesta.blob();
    }, (indice) => progreso.push(indice));
    const extraidas = unzipSync(new Uint8Array(await zip.arrayBuffer()));
    assert.deepEqual(Object.keys(extraidas), ['01 - Sala & patio.JPG', '02 - Fachada.PNG']);
    assert.deepEqual(Buffer.from(extraidas['01 - Sala & patio.JPG']), fotoJpeg);
    assert.deepEqual(Buffer.from(extraidas['02 - Fachada.PNG']), fotoPng);
    assert.deepEqual(progreso, [1, 2]);
    assert.equal((await listar('https://drive.google.com/drive/folders/restringida')).status, 422);
    assert.equal((await listar('https://drive.google.com/drive/folders/formato-distinto')).status, 422);
    const alterna = await listar('https://drive.google.com/u/0/folderview?id=carpeta-alterna&resourceKey=clave-carpeta');
    assert.equal(alterna.status, 200);
    const listadoAlterno = (await alterna.json()).fotos;
    assert.deepEqual(listadoAlterno.map(({ id, name, resourceKey }) => ({ id, name, resourceKey })), [
      { id: 'foto-lateral', name: 'Patio d’entrada #1.JPG', resourceKey: 'clave-lateral' },
    ]);

    const guardado = await request(POST, 'POST', { token: seller, body: {
      ciudad_zona: 'Phoenix', precio: 250000, drive_url: embebido,
      generar_anuncios: false, fotos_drive_ids: ['foto-2'], portada_drive_id: 'foto-2',
    } });
    assert.equal(guardado.status, 200);
    const { propiedad } = await guardado.json();
    assert.deepEqual(propiedad.fotos_drive, [{ id: 'foto-2', name: 'Fachada.PNG', miniaturaDrive: fotos[1].miniaturaDrive }]);
    const inventario = await request(GET, 'GET', { token: seller });
    assert.deepEqual((await inventario.json()).propiedades.find(({ id }) => id === propiedad.id).fotos_drive, [fotos[1]]);

    const portada = () => PORTADA(new Request('https://panel.test/api/propiedades/casa-2/portada'), {
      params: Promise.resolve({ id: propiedad.id }),
    });
    assert.equal((await portada()).status, 404);
    driveSinAcceso = true;
    const fallo = await request(PATCH, 'PATCH', { token: seller, body: {
      id: propiedad.id, accion: 'publicar', portada_drive_revisada: 'foto-2', carpeta_revisada: embebido,
    } });
    assert.equal(fallo.status, 503);
    assert.equal(properties.get(propiedad.id).publicada_en, null);
    driveSinAcceso = false;
    const publicado = await request(PATCH, 'PATCH', { token: seller, body: {
      id: propiedad.id, accion: 'publicar', portada_drive_revisada: 'foto-2', carpeta_revisada: embebido,
    } });
    assert.equal(publicado.status, 200);
    driveSinAcceso = true;
    const antesPortada = serviceCalls.length;
    const respuesta = await portada();
    assert.equal(respuesta.status, 200);
    assert.equal(respuesta.headers.get('Content-Type'), 'image/webp');
    assert.ok(serviceCalls.slice(antesPortada).every((ruta) => !ruta.includes('/drive/')));
    driveSinAcceso = false;
    const antigua = properties.get(propiedad.id);
    properties.set(propiedad.id, { ...antigua, portada_publica_id: null, portada_webp: null });
    const antesAntigua = serviceCalls.length;
    assert.equal((await portada()).status, 404);
    assert.deepEqual(serviceCalls.slice(antesAntigua), ['/rest/v1/propiedades']);
    for (const estado of ['en_contrato', 'vendida']) {
      properties.set(propiedad.id, { ...antigua, estado });
      assert.equal((await portada()).status, 404);
    }
  } finally {
    driveSinAcceso = false;
    process.env.GOOGLE_DRIVE_API_KEY = clave;
  }
});


test('el ZIP evita colisiones de nombres y conserva el error de una descarga incompleta', async () => {
  const { crearZipFotos } = await import('../lib/zip-fotos.ts');
  const seleccion = ['a', 'b'].map((id) => ({ id, name: 'Fotos/Sala.jpg' }));
  const original = new Blob([fotoJpeg]);
  const zip = await crearZipFotos(seleccion, async () => original, () => {});
  const archivos = unzipSync(new Uint8Array(await zip.arrayBuffer()));
  assert.deepEqual(Object.keys(archivos), ['01 - Fotos_Sala.jpg', '02 - Fotos_Sala.jpg']);
  await assert.rejects(crearZipFotos(seleccion, async ({ id }) => {
    if (id === 'b') throw new Error('Permiso denegado');
    return original;
  }, () => {}), /Fotos\/Sala.jpg.*Permiso denegado/);
  await assert.rejects(crearZipFotos(Array(61).fill(seleccion[0]), async () => original, () => {}), /60 fotos/);
});

test('los cuatro borradores se generan con datos públicos y la aprobación corresponde al texto guardado', async () => {
  const { POST: TEXTOS } = await import('../app/api/admin/textos/route.ts');
  const id = 'texto-casa';
  const ficha = {
    id, textos_version: 0, ciudad_zona: 'Mesa, AZ 85201', precio: 225000,
    arv: 310000, estado: 'disponible', beds: 3, baths: 2,
    lot_size: '1234 Privada Street', direccion_privada: '1234 Privada Street',
    notas_extra: 'Esto es privado y no se debe pasar a Gemini',
    drive_url: 'https://drive.google.com/drive/folders/privada',
  };
  properties.set(id, ficha);

  function operar(body, token = seller) {
    return TEXTOS(new Request('https://panel.test/api/admin/textos', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...body }),
    }));
  }

  assert.equal((await operar({ accion: 'generar', version: 0 }, outsider)).status, 403);
  const start = entradasGemini.length;
  const generados = await operar({
    accion: 'generar', version: 0, condiciones: { financiamiento: true, enganche: 17, incluirArv: true },
  });
  assert.equal(generados.status, 200);
  const primera = await generados.json();
  assert.equal(primera.origen, 'gemini');
  for (const [canal, texto] of Object.entries(scripts)) {
    assert.equal(primera.textos[canal], texto);
    assert.equal(primera.textos[`${canal}_aprobado`], false);
  }
  const cargaGemini = entradasGemini[start];
  assert.match(cargaGemini, /Mesa, AZ 85201/);
  assert.match(cargaGemini, /310000/);
  assert.match(cargaGemini, /enganche/);
  assert.doesNotMatch(cargaGemini, /Privada Street|Esto es privado|drive\.google\.com|notas_extra/);

  const canal = 'script_fb_es';
  assert.equal((await operar({ accion: 'aprobar', version: 1, canal, texto: 'Texto no guardado' })).status, 409);
  const aprobacion = await operar({ accion: 'aprobar', version: 1, canal, texto: scripts[canal] });
  assert.equal(aprobacion.status, 200);
  const aprobados = (await aprobacion.json()).textos;
  assert.equal(aprobados.script_fb_es_aprobado, true);
  assert.equal(aprobados.script_fb_en_aprobado, false);

  assert.equal((await operar({ accion: 'guardar', version: 1, canal, texto: 'Versión vieja' })).status, 409);
  const guardado = await operar({ accion: 'guardar', version: 2, canal, texto: 'Texto corregido' });
  assert.equal(guardado.status, 200);
  const corregidos = (await guardado.json()).textos;
  assert.equal(corregidos.script_fb_es, 'Texto corregido');
  assert.equal(corregidos.script_fb_es_aprobado, false);

  simularGeminiInvalido = true;
  try {
    const respaldos = await operar({ accion: 'generar', version: 3, condiciones: { itin: true } });
    assert.equal(respaldos.status, 200);
    const respaldo = await respaldos.json();
    assert.equal(respaldo.origen, 'plantillas');
    assert.match(respaldo.textos.script_fb_es, /ITIN/);
    assert.doesNotMatch(respaldo.textos.script_fb_es, /enganche|pasaporte|financiamiento|310,000/i);
    assert.equal(respaldo.textos.script_fb_es_aprobado, false);
    assert.equal((await operar({
      accion: 'aprobar', version: 4, canal, texto: respaldo.textos.script_fb_es,
    })).status, 200);
  } finally {
    simularGeminiInvalido = false;
  }
});

test('la generación rechaza una posible dirección escrita como zona pública', async () => {
  const { POST: TEXTOS } = await import('../app/api/admin/textos/route.ts');
  const id = 'zona-direccion';
  properties.set(id, { id, textos_version: 0, ciudad_zona: '12345 W Main St', precio: 100000, estado: 'disponible' });
  const start = entradasGemini.length;
  const respuesta = await TEXTOS(new Request('https://panel.test/api/admin/textos', {
    method: 'POST',
    headers: { Authorization: `Bearer ${seller}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, accion: 'generar', version: 0 }),
  }));
  assert.equal(respuesta.status, 400);
  assert.equal(entradasGemini.length, start);
});

test('la vigencia vence a las 72 horas sin ocultar propiedades disponibles', async () => {
  const { etiquetaDisponibilidad } = await import('../lib/disponibilidad.ts');
  const confirmacion = '2026-11-16T19:00:00.000Z';
  const limite = Date.parse('2026-11-19T19:00:00.000Z');
  assert.equal(etiquetaDisponibilidad('disponible', confirmacion, limite - 1), 'Disponible');
  assert.equal(etiquetaDisponibilidad('disponible', confirmacion, limite), 'Por confirmar');
  assert.equal(etiquetaDisponibilidad('disponible', null, limite), 'Por confirmar');
  assert.equal(etiquetaDisponibilidad('en_contrato', confirmacion, limite), 'En contrato');
  assert.equal(etiquetaDisponibilidad('vendida', confirmacion, limite), 'Ya no disponible');
});

test('la cola prioriza fichas pendientes por antigüedad y el inventario permite llegar a las históricas', async () => {
  const anteriores = new Map(properties);
  properties.clear();
  try {
    const hoy = new Date().toISOString();
    for (let i = 1; i <= 12; i++) {
      const fecha = `2020-11-${String(i).padStart(2, '0')}T12:00:00Z`;
      properties.set(`id-${i}`, { id: `id-${i}`, publicada_en: fecha, estado: 'disponible',
        ultima_confirmacion: i % 2 === 0 ? null : fecha, ciudad_zona: 'Mesa', notas_extra: 'privada' });
    }
    properties.set('nueva', { id: 'nueva', publicada_en: hoy, estado: 'disponible', ultima_confirmacion: hoy });
    properties.set('borrador', { id: 'borrador', publicada_en: null, estado: 'disponible' });
    for (let i = 1; i <= 20; i++) {
      properties.set(`vendida-${i}`, { id: `vendida-${i}`, publicada_en: hoy, estado: 'vendida' });
    }
    const cargar = async (query) => (await request(GET, 'GET', { token: seller, query })).json();
    const cola = await cargar('?vista=por_confirmar&pagina=0');
    assert.deepEqual(cola.propiedades.map(({ id }) => id), Array.from({ length: 10 }, (_, i) => `id-${i + 1}`));
    assert.equal(cola.hayMas, true);
    assert.equal(Object.hasOwn(cola.propiedades[0], 'notas_extra'), false);
    const resto = await cargar('?vista=por_confirmar&pagina=1');
    assert.deepEqual(resto.propiedades.map(({ id }) => id), ['id-11', 'id-12']);
    assert.equal(resto.hayMas, false);
    const primera = await cargar('?pagina=0');
    const segunda = await cargar('?pagina=1');
    assert.equal(primera.propiedades.length, 25);
    assert.equal(primera.hayMas, true);
    assert.equal(segunda.hayMas, false);
    assert.equal(new Set([...primera.propiedades, ...segunda.propiedades].map(({ id }) => id)).size, properties.size);
    assert.equal((await request(GET, 'GET', { token: seller, query: '?pagina=-1' })).status, 400);
  } finally {
    properties.clear();
    for (const [id, ficha] of anteriores) properties.set(id, ficha);
  }
});

test('confirmar y reactivar actualizan la fecha sin cambiar el identificador de la ficha', async () => {
  const id = 'casa-disponibilidad';
  const publicada = '2026-11-15T00:00:00.000Z';
  properties.set(id, { id, estado: 'disponible', ciudad_zona: 'Tempe', precio: 250000, publicada_en: publicada, ultima_confirmacion: publicada });

  const cambiar = (estado) => request(PATCH, 'PATCH', { token: seller, body: { id, estado } });

  assert.equal((await cambiar('por_confirmar')).status, 400);
  const inicio = Date.now();
  const confirmar = await cambiar('disponible');
  assert.equal(confirmar.status, 200);
  const { disponibilidad: confirmada } = await confirmar.json();
  assert.equal(confirmada.id, id);
  assert.ok(Date.parse(confirmada.ultima_confirmacion) >= inicio);

  const contrato = await cambiar('en_contrato');
  assert.equal((await contrato.json()).disponibilidad.estado, 'en_contrato');
  const retirada = await cambiar('vendida');
  assert.deepEqual((await retirada.json()).disponibilidad, {
    id, estado: 'vendida', ficha_version: 3, ultima_confirmacion: confirmada.ultima_confirmacion,
  });

  const reactivacion = await cambiar('disponible');
  assert.equal(reactivacion.status, 200);
  const reactivada = (await reactivacion.json()).disponibilidad;
  assert.equal(reactivada.id, id);
  assert.ok(Date.parse(reactivada.ultima_confirmacion) >= Date.parse(confirmada.ultima_confirmacion));
  assert.equal(properties.get(id).publicada_en, publicada);

  assert.equal((await request(PATCH, 'PATCH', {
    token: seller, body: { id: 'ficha-que-no-existe', estado: 'disponible' },
  })).status, 404);
});


test('el aviso trae fichas vigentes de días anteriores y comparte solo un enlace al catálogo', async () => {
  const { cargarFichasDelAviso, prepararAvisoWhatsApp } = await import('../lib/aviso-whatsapp.ts');
  const respaldo = [...properties.entries()];
  properties.clear();
  try {
    const fecha = '2026-11-15T00:00:00Z';
    const reciente = '2026-11-19T18:00:00Z';
    const ahora = Date.parse('2026-11-19T19:00:00Z');
    const base = { publicada_en: fecha, ultima_confirmacion: reciente, precio: 250000, estado: 'disponible' };
    properties.set('pendiente', { ...base, ciudad_zona: 'Mesa 85201', ultima_confirmacion: fecha, precio: 189000.5 });
    properties.set('confirmada', { ...base, ciudad_zona: 'Phoenix 85035', direccion_privada: '123 Calle privada' });
    properties.set('contrato', { ...base, ciudad_zona: 'En contrato', estado: 'en_contrato' });
    properties.set('vendida', { ...base, ciudad_zona: 'Ya no disponible', estado: 'vendida' });
    properties.set('borrador', { ...base, ciudad_zona: 'Borrador privado', publicada_en: null });
    for (let i = 0; i < 99; i++) {
      properties.set(`previa-${i}`, { ...base, ciudad_zona: `Tempe ${i}` });
    }

    const fichas = await cargarFichasDelAviso();
    assert.equal(fichas.length, 101);
    const aviso = prepararAvisoWhatsApp(fichas, 'https://catalogo.test/admin', ahora);
    assert.match(aviso, /Phoenix 85035 — \$250,000 USD/);
    assert.match(aviso, /Mesa 85201 — \$189,000\.5 USD \(Por confirmar\)/);
    assert.ok(aviso.indexOf('Phoenix') < aviso.indexOf('Mesa'));
    assert.match(aviso, /Tempe 98/);
    assert.doesNotMatch(aviso, /Calle privada|En contrato|Ya no disponible|Borrador privado/);
    assert.deepEqual(aviso.match(/https?:\/\/[^\s]+/g), ['https://catalogo.test/']);
    assert.equal(prepararAvisoWhatsApp([], 'https://catalogo.test', ahora), '');
  } finally {
    properties.clear();
    for (const [id, ficha] of respaldo) properties.set(id, ficha);
  }
});


test('corregir el precio actualiza una ficha publicada y los avisos posteriores', async () => {
  const { cargarFichasDelAviso, prepararAvisoWhatsApp } = await import('../lib/aviso-whatsapp.ts');
  const id = 'casa-correccion-precio';
  const base = {
    id, ciudad_zona: 'Scottsdale 85251', publicada_en: '2026-11-18T00:00:00Z',
    ultima_confirmacion: '2026-11-19T12:00:00Z', estado: 'disponible',
    precio: 200000, script_fb_es: 'Edición del vendedor',
  };
  properties.set(id, base);
  properties.set('borrador-precio', { ...base, publicada_en: null });
  const cambiar = (importe, anterior = 200000, ficha = id) => request(PATCH, 'PATCH', {
    token: seller,
    body: { accion: 'corregir_precio', id: ficha, precio: importe, precio_anterior: anterior },
  });

  assert.equal((await cambiar(0)).status, 400);
  assert.equal((await cambiar(200000.123)).status, 400);
  assert.equal((await cambiar(220000, 200000, 'borrador-precio')).status, 409);

  const respuesta = await cambiar(215500.25);
  assert.equal(respuesta.status, 200);
  assert.equal((await respuesta.json()).ficha.precio, 215500.25);
  assert.equal((await cambiar(220000)).status, 409);
  assert.equal(properties.get(id).id, id);
  assert.equal(properties.get(id).publicada_en, base.publicada_en);
  assert.equal(properties.get(id).script_fb_es, base.script_fb_es);

  const fichas = await cargarFichasDelAviso();
  const aviso = prepararAvisoWhatsApp(fichas, 'https://catalogo.test', Date.parse('2026-11-19T19:00:00Z'));
  assert.ok(aviso.includes('Scottsdale 85251 — $215,500.25 USD'));
  assert.ok(!aviso.includes('Scottsdale 85251 — $200,000 USD'));
});


test('el registro VIP es público y solo el operador autorizado puede consultar el teléfono', async () => {
  const { POST: registrar } = await import('../app/api/compradores-vip/route.ts');
  const { GET: listar } = await import('../app/api/admin/compradores-vip/route.ts');
  const { chatComprador } = await import('../lib/compradores-vip.ts');
  const registro = { nombre: '  Comprador de prueba  ', whatsapp: '(602) 555-0123', pais: 'US', perfil: 'inversionista', tiene_itin: true };

  const publicar = (body) => registrar(new Request('https://panel.test/api/compradores-vip', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }));
  const consultar = (token, pagina = '') => listar(new Request(`https://panel.test/api/admin/compradores-vip${pagina}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  }));

  assert.equal((await publicar({ ...registro, whatsapp: 'https://example.test' })).status, 400);
  assert.equal((await publicar({ ...registro, perfil: 'otro' })).status, 400);
  const resultado = await publicar({ ...registro, campo_ajeno: 'ignorar' });
  assert.equal(resultado.status, 201);
  assert.deepEqual(await resultado.json(), { ok: true });

  const inicio = serviceCalls.length;
  assert.equal((await consultar()).status, 401);
  assert.equal((await consultar(outsider)).status, 403);
  assert.deepEqual(serviceCalls.slice(inicio), ['/auth/v1/user']);
  assert.equal((await consultar(seller, '?pagina=-1')).status, 400);
  const lista = await consultar(seller);
  assert.match(lista.headers.get('cache-control'), /private, no-store/);
  const datos = await lista.json();
  assert.deepEqual(datos, {
    compradores: [{ id: 1, nombre: 'Comprador de prueba', whatsapp: '+16025550123', perfil: 'inversionista', tiene_itin: true }],
    hayMas: false,
  });
  assert.equal(chatComprador(datos.compradores[0].whatsapp), 'https://wa.me/16025550123');
  assert.equal(chatComprador('+52 (662) 123-4567'), 'https://wa.me/5216621234567');
  assert.equal(chatComprador('602-555-0123'), null);
  assert.equal(chatComprador('+5216621234567'), 'https://wa.me/5216621234567');
  assert.equal((await publicar({ ...registro, pais: undefined })).status, 400);
  assert.equal((await publicar({ ...registro, pais: 'US', whatsapp: '+526621234567' })).status, 400);
  assert.equal((await publicar({ ...registro, pais: 'MX', whatsapp: '6621234567' })).status, 201);
  assert.equal(compradores[0].whatsapp, '+526621234567');
  assert.equal(chatComprador('dato inválido'), null);
});

test('la generación indica qué falta y funciona al completar zona y precio en un borrador sin portada', async () => {
  const { POST: generar } = await import('../app/api/admin/textos/route.ts');
  const id = 'borrador-textos-sin-portada';
  properties.set(id, { id, textos_version: 0, ciudad_zona: null, precio: 200000, estado: 'disponible', publicada_en: null });
  const solicitarTextos = () => generar(new Request('https://panel.test/api/admin/textos', {
    method: 'POST',
    headers: { Authorization: `Bearer ${seller}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, accion: 'generar', version: 0 }),
  }));
  const incompleto = await solicitarTextos();
  assert.equal(incompleto.status, 400);
  assert.equal((await incompleto.json()).error, 'Falta guardar la ciudad o el código postal de la propiedad.');

  const guardado = await request(PATCH, 'PATCH', { token: seller, body: {
    id, accion: 'guardar_borrador', ficha: { ciudad_zona: 'Phoenix 85035', precio: 200000 },
  } });
  assert.equal(guardado.status, 200);
  const respuesta = await solicitarTextos();
  assert.equal(respuesta.status, 200);
  assert.equal((await respuesta.json()).textos.script_fb_es, scripts.script_fb_es);
  assert.equal(properties.get(id).publicada_en, null);
  assert.equal(properties.get(id).imagen_portada, null);
});

test('descarta que la casa requiere arreglos o admite crédito bancario cuando solo se confirmó financiamiento privado', async () => {
  const { datosAnuncio, generarTextos } = await import('../app/api/admin/textos/generador.ts');
  const datos = datosAnuncio({ ciudad_zona: 'Peoria AZ 85345', precio: 292000 }, {
    financiamiento: true, arreglos: true, itin: true, enganche: 17,
  });
  for (const texto of ['La propiedad requiere algunos arreglos.', 'Aceptamos financiamiento bancario.',
    'The property requires repairs.', 'Standard financing is available.']) {
    respuestaGeminiDePrueba = { ...scripts, script_fb_es: texto };
    try {
      const resultado = await generarTextos(datos);
      assert.equal(resultado.origen, 'plantillas');
      assert.match(resultado.textos.script_fb_es, /Financiamiento privado disponible/);
      assert.match(resultado.textos.script_fb_es, /Financiamiento para arreglos disponible/);
      assert.doesNotMatch(resultado.textos.script_fb_es, /requiere|bancario/i);
    } finally {
      respuestaGeminiDePrueba = undefined;
    }
  }
});

test('el operador registra, consulta y actualiza una casa ofrecida en privado', async () => {
  const { GET, POST, PATCH } = await import('../app/api/admin/casas-ofrecidas/route.ts');
  const datos = { nombre: 'Propietaria de prueba', whatsapp: '6621234567', pais: 'MX', zona: 'Mesa 85201',
    condicion: 'por_confirmar', fotos_url: 'https://drive.google.com/drive/folders/prueba' };
  const operar = (handler, method, token, body) => handler(new Request('https://panel.test/api/admin/casas-ofrecidas', {
    method, headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: body ? JSON.stringify(body) : undefined,
  }));
  assert.equal((await operar(GET, 'GET')).status, 401);
  assert.equal((await operar(GET, 'GET', outsider)).status, 403);
  assert.equal((await operar(POST, 'POST', outsider, datos)).status, 403);
  assert.equal((await operar(POST, 'POST', seller, { ...datos, fotos_url: 'javascript:alert(1)' })).status, 400);
  const respuesta = await operar(POST, 'POST', seller, datos);
  assert.equal(respuesta.status, 201);
  const { casa } = await respuesta.json();
  assert.equal(casa.estado, 'nueva');
  assert.equal(casa.whatsapp, '+526621234567');
  assert.equal(casa.precio_esperado, null);
  const lista = await operar(GET, 'GET', seller);
  assert.match(lista.headers.get('cache-control'), /private, no-store/);
  assert.deepEqual((await lista.json()).casas, [casa]);
  assert.equal((await operar(PATCH, 'PATCH', outsider, { id: casa.id, estado: 'contactada' })).status, 403);
  const cambio = await operar(PATCH, 'PATCH', seller, { id: casa.id, estado: 'en_evaluacion' });
  assert.equal(cambio.status, 200);
  assert.equal((await cambio.json()).casa.estado, 'en_evaluacion');
});

test('un propietario envía su casa desde el catálogo y aparece como nueva en la bandeja privada', async () => {
  const { POST } = await import('../app/api/casas-ofrecidas/route.ts');
  const { GET } = await import('../app/api/admin/casas-ofrecidas/route.ts');
  const base = { nombre: 'Persona de prueba', zona: 'Phoenix 85035', pais: 'US', whatsapp: '6025550123',
    condicion: 'habitable', estado: 'cerrada', notas: 'Puedo conversar esta semana.' };
  const publicar = (body) => POST(new Request('https://panel.test/api/casas-ofrecidas', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }));

  assert.equal((await publicar({ ...base, whatsapp: '' })).status, 400);
  const respuesta = await publicar(base);
  assert.equal(respuesta.status, 201);
  assert.deepEqual(await respuesta.json(), { ok: true });

  const privada = await GET(new Request('https://panel.test/api/admin/casas-ofrecidas', {
    headers: { Authorization: `Bearer ${seller}` },
  }));
  const { casas } = await privada.json();
  const casa = casas.find((item) => item.nombre === base.nombre);
  assert.equal(casa.estado, 'nueva');
  assert.equal(casa.whatsapp, '+16025550123');
  assert.equal(casa.zona, 'Phoenix 85035');
});

test('regenerar un canal conserva los demás textos y revisa sus aprobaciones al cambiar los datos compartidos', async () => {
  const { POST: generar } = await import('../app/api/admin/textos/route.ts');
  const id = 'casa-regeneracion';
  const condiciones = { publico: 'vivienda', rasgos: ['techoNuevo', 'piscina'], itin: true };
  const aprobaciones = Object.fromEntries(Object.keys(scripts).map((canal) => [`${canal}_aprobado`, true]));
  properties.set(id, {
    id, textos_version: 5, estado: 'disponible', precio: 235000, ciudad_zona: 'Mesa',
    notas_extra: 'teléfono privado del propietario', direccion_privada: '333 W Main Street',
    ...scripts, script_fb_en: 'Edited English copy', ...aprobaciones, condiciones_texto: condiciones,
  });
  const regenerar = (version, cambios) => request(generar, 'POST', {
    token: seller, body: { id, version, accion: 'generar', canal: 'script_fb_es', ...cambios },
  });
  const inicio = entradasGemini.length;
  assert.equal((await regenerar(5, { condiciones: { rasgos: ['333 W Main Street'] } })).status, 400);
  assert.equal((await regenerar(5, { condiciones: { rasgos: ['piscina', 'garaje', 'techoNuevo'] } })).status, 400);
  assert.equal((await regenerar(5, { canal: 'otra' })).status, 400);
  assert.equal(entradasGemini.length, inicio);
  const primera = await regenerar(5, { condiciones: { ...condiciones, rasgos: ['piscina', 'techoNuevo'], contado: false } });
  assert.equal(primera.status, 200);
  const { textos, origen } = await primera.json();
  assert.equal(origen, 'gemini');
  assert.equal(textos.script_fb_es_aprobado, false);
  assert.equal(textos.script_fb_en, 'Edited English copy');
  assert.equal(textos.script_fb_en_aprobado, true);
  assert.equal(textos.script_wa_vip_aprobado, true);
  assert.equal(textos.script_filtro_curiosos_aprobado, true);
  const llamada = JSON.parse(entradasGemini[inicio]);
  assert.deepEqual(llamada.generationConfig.responseSchema.required, ['script_fb_es']);
  assert.match(llamada.contents[0].parts[0].text, /"publico":"vivienda"/);
  assert.match(llamada.contents[0].parts[0].text, /Techo nuevo/);
  assert.doesNotMatch(entradasGemini[inicio], /privado del propietario|333 W Main Street/);
  assert.equal((await regenerar(5)).status, 409);

  const segunda = await regenerar(6, { condiciones: { publico: 'inversion', rasgos: ['garaje'] } });
  assert.equal(segunda.status, 200);
  const actualizados = (await segunda.json()).textos;
  assert.equal(actualizados.textos_version, 7);
  assert.equal(actualizados.script_fb_en, 'Edited English copy');
  assert.deepEqual(actualizados.condiciones_texto, { publico: 'inversion', rasgos: ['garaje'] });
  for (const canal of Object.keys(scripts)) assert.equal(actualizados[`${canal}_aprobado`], false);
});

test('una regeneración en curso respeta la corrección concurrente del precio', async () => {
  const { POST: generar } = await import('../app/api/admin/textos/route.ts');
  const id = 'precio-mientras-se-redacta';
  properties.set(id, { id, ciudad_zona: 'Mesa', precio: 210000, textos_version: 2,
    estado: 'disponible', script_fb_es: 'Texto editado por Sergio' });
  const fetchAnterior = globalThis.fetch;
  try {
    globalThis.fetch = async (input, init) => {
      if (new URL(input instanceof Request ? input.url : input).hostname === 'generativelanguage.googleapis.com') {
        properties.set(id, { ...properties.get(id), precio: 197000, textos_version: 3 });
      }
      return fetchAnterior(input, init);
    };
    const respuesta = await request(generar, 'POST', { token: seller, body: {
      id, version: 2, accion: 'generar', canal: 'script_fb_es',
    } });
    assert.equal(respuesta.status, 409);
    assert.equal(properties.get(id).precio, 197000);
    assert.equal(properties.get(id).textos_version, 3);
    assert.equal(properties.get(id).script_fb_es, 'Texto editado por Sergio');
  } finally {
    globalThis.fetch = fetchAnterior;
  }
});

test('las plantillas usan el mismo público en ambos idiomas y solo los rasgos confirmados', async () => {
  const { datosAnuncio, generarTextos } = await import('../app/api/admin/textos/generador.ts');
  const apiKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  try {
    const ficha = { ciudad_zona: 'Mesa', precio: 235000, notas_extra: 'Piscina', arv: 270000 };
    const datos = datosAnuncio(ficha, { publico: 'inversion', rasgos: ['techoNuevo'] });
    const resultado = await generarTextos(datos);
    assert.equal(resultado.origen, 'plantillas');
    assert.match(resultado.textos.script_fb_es, /inversiones.*Mesa/s);
    assert.match(resultado.textos.script_fb_es, /techo nuevo/i);
    assert.match(resultado.textos.script_fb_en, /comparing deals/i);
    assert.match(resultado.textos.script_fb_en, /new roof/i);
    assert.doesNotMatch(JSON.stringify(resultado.textos), /piscina|Pool|270,000/i);
    const individual = await generarTextos(datosAnuncio(ficha, { publico: 'vivienda' }), 'script_fb_en');
    assert.deepEqual(Object.keys(individual.textos), ['script_fb_en']);
    assert.match(individual.textos.script_fb_en, /call home/i);
  } finally {
    process.env.GEMINI_API_KEY = apiKey;
  }
});

test('los filtros reconocen ciudad y ZIP existentes sin confundir localidades', async () => {
  const { separarUbicacion, unirUbicacion } = await import('../lib/ciudades-phoenix.ts');
  assert.deepEqual(separarUbicacion('Peoria, AZ 85345'), { ciudad: 'Peoria', zip: '85345' });
  assert.deepEqual(separarUbicacion('tempe Arizona 85281-1234'), { ciudad: 'Tempe', zip: '85281' });
  assert.deepEqual(separarUbicacion('Mesa'), { ciudad: 'Mesa', zip: '' });
  assert.deepEqual(separarUbicacion('East Mesa 85201'), { ciudad: '', zip: '85201' });
  assert.deepEqual(separarUbicacion(null), { ciudad: '', zip: '' });
  assert.equal(unirUbicacion('Chandler', '85225'), 'Chandler, AZ 85225');
  assert.equal(unirUbicacion('Phoenix', ''), 'Phoenix, AZ');
});

test('una versión antigua no sobrescribe un borrador y la versión es obligatoria', async () => {
  const id = 'version-borrador';
  properties.set(id, { id, publicada_en: null, ficha_version: 2, ciudad_zona: 'Peoria', notas_extra: 'Cambio reciente' });
  const guardar = (ficha_version) => PATCH(new Request('https://panel.test/api/admin/propiedades', {
    method:'PATCH',headers:{ Authorization: `Bearer ${seller}`, 'Content-Type':'application/json' },
    body:JSON.stringify({ id, accion:'guardar_borrador', ficha_version, ficha:{ciudad_zona:'Peoria',notas_extra:'Cambio viejo'} }),
  }));
  assert.equal((await guardar(undefined)).status,400);
  assert.equal((await guardar(-1)).status,400);
  assert.equal((await guardar(1)).status,409);
  assert.equal(properties.get(id).notas_extra,'Cambio reciente');
  assert.equal((await guardar(2)).status,200);
  assert.equal(properties.get(id).notas_extra,'Cambio viejo');
  assert.equal((await guardar(2)).status,409);
  properties.delete(id);
});

test('la captación rechaza cuerpos excesivos y descarta el campo trampa sin escribir', async () => {
  const { POST: registrar } = await import('../app/api/compradores-vip/route.ts');
  const inicio = serviceCalls.length;
  const enviar = (body) => registrar(new Request('https://panel.test/api/compradores-vip', {
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),
  }));
  assert.equal((await enviar({ sitio_web:'https://bot.test' })).status,201);
  assert.equal((await enviar({ nombre:'x'.repeat(20000) })).status,400);
  assert.deepEqual(serviceCalls.slice(inicio),[]);
});

test('guardar datos con fotos previamente verificadas funciona durante una caída de Drive', async () => {
  const id = 'correccion-sin-drive';
  properties.set(id,{ id,publicada_en:null,ficha_version:0,drive_url:carpetaDrive,fotos_drive:[fotoDrive] });
  const inicio = serviceCalls.length;
  driveSinAcceso = true;
  try {
    const respuesta = await request(PATCH,'PATCH',{token:seller,body:{id,accion:'guardar_borrador',ficha:{
      ciudad_zona:'Peoria',precio:292000,drive_url:carpetaDrive,fotos_drive_ids:[fotoDrive.id],portada_drive_id:fotoDrive.id,notas_extra:'Corregida',
    }}});
    assert.equal(respuesta.status,200);
    assert.equal(properties.get(id).notas_extra,'Corregida');
    assert.deepEqual(properties.get(id).fotos_drive,[fotoDrive]);
    assert.ok(serviceCalls.slice(inicio).every((ruta) => !ruta.includes('/drive/') && ruta !== '/embeddedfolderview'));
  } finally { driveSinAcceso=false; properties.delete(id); }
});

test('la galería usa copias revisadas, revalida ETag y deja de servirlas al retirar la ficha', async () => {
  const { GET: galeria } = await import('../app/api/propiedades/[id]/fotos/route.ts');
  const { GET: foto } = await import('../app/api/propiedades/[id]/fotos/[foto]/route.ts');
  const id = 'copia-publica';
  properties.set(id,{id,ficha_version:0,publicada_en:null,estado:'disponible',ciudad_zona:'Peoria',precio:250000,
    drive_url:carpetaDrive,fotos_drive:[fotoDrive],portada_drive_id:fotoDrive.id});
  const preparar = () => PREPARAR(new Request(`https://panel.test/api/admin/material-publico?id=${id}&version=0&fuente=${fotoDrive.id}`,{
    method:'POST',headers:{Authorization:`Bearer ${seller}`},
  }));
  assert.equal((await PREPARAR(new Request(`https://panel.test/api/admin/material-publico?id=${id}`,{method:'POST'}))).status,401);
  const reservas = await Promise.all([preparar(),preparar()]);
  assert.deepEqual(reservas.map((r) => r.status).sort(),[200,409]);
  const copia = await reservas.find((r) => r.ok).json();
  const context = {params:Promise.resolve({id})};
  assert.equal((await galeria(new Request('https://panel.test'),context)).status,404);
  const publicada = await request(PATCH,'PATCH',{token:seller,body:{id,accion:'publicar',material_revisado:true,
    portada_publica_id:copia.id,galeria_publica_ids:[copia.id],portada_drive_revisada:fotoDrive.id,carpeta_revisada:carpetaDrive}});
  assert.equal(publicada.status,200);
  driveSinAcceso=true;
  try {
    const listado = await (await galeria(new Request('https://panel.test'),context)).json();
    assert.equal(listado.fotos.length,1);
    assert.doesNotMatch(JSON.stringify(listado),/google|Sala|clave-foto|foto-1/);
    const fotoContext = {params:Promise.resolve({id,foto:copia.id})};
    const respuesta = await foto(new Request('https://panel.test'),fotoContext);
    assert.equal(respuesta.status,200);
    const tag = respuesta.headers.get('etag');
    const antes = serviceCalls.length;
    assert.equal((await foto(new Request('https://panel.test',{headers:{'If-None-Match':tag}}),fotoContext)).status,304);
    assert.equal(serviceCalls.slice(antes).filter((p) => p==='/rest/v1/material_publico').length,1);
    properties.get(id).estado='vendida';
    assert.equal((await foto(new Request('https://panel.test',{headers:{'If-None-Match':tag}}),fotoContext)).status,404);
    assert.equal((await galeria(new Request('https://panel.test'),context)).status,404);
  } finally { driveSinAcceso=false; properties.delete(id); }
});

test('el catálogo pagina y filtra en la consulta con conteo total consistente', async () => {
  const { GET: catalogo } = await import('../app/api/catalogo/route.ts');
  const anteriores = [...properties];
  properties.clear();
  try {
    for (let i=0;i<25;i++) properties.set(`p-${String(i).padStart(2,'0')}`,{
      id:`p-${String(i).padStart(2,'0')}`,created_at:'2026-11-25',publicada_en:'2026-11-25',estado:'disponible',
      ciudad_zona:'Peoria, AZ 85345',ciudad:'Peoria',zip:'85345',precio:292000,
    });
    properties.get('p-24').precio=250000;
    properties.set('otra',{id:'otra',created_at:'2026-11-25',publicada_en:'2026-11-25',estado:'disponible',ciudad:'Mesa',zip:'85201'});
    const primera = await (await catalogo(new Request('https://panel.test/api/catalogo?ciudad=Peoria&zip=853&pagina=0'))).json();
    assert.equal(primera.total,25); assert.equal(primera.propiedades.length,12); assert.equal(primera.precioDesde,250000);
    const ultima = await (await catalogo(new Request('https://panel.test/api/catalogo?ciudad=Peoria&zip=853&pagina=2'))).json();
    assert.equal(ultima.total,25); assert.equal(ultima.precioDesde,250000); assert.equal(ultima.propiedades.length,1); assert.equal(ultima.propiedades[0].id,'p-24');
    assert.equal((await catalogo(new Request('https://panel.test/api/catalogo?ciudad=Inventada'))).status,400);
    assert.equal((await catalogo(new Request('https://panel.test/api/catalogo?pagina=-1'))).status,400);
  } finally { properties.clear(); for (const [id,valor] of anteriores) properties.set(id,valor); }
});

test('el diagnóstico devuelve una referencia y excluye mensajes y datos privados', async () => {
  const { respuestaFallo } = await import('../lib/diagnostico.ts');
  const original = console.error;
  const registros = [];
  console.error = (dato) => registros.push(dato);
  try {
    const respuesta = respuestaFallo('prueba.consultar',{code:'23514',message:'teléfono privado +526621234567',details:'clave-secreta',hint:'domicilio privado'});
    const datos = await respuesta.json();
    assert.equal(respuesta.status,503);
    assert.equal(JSON.parse(registros[0]).incidente,datos.incidente);
    assert.equal(respuesta.headers.get('x-incidente'),datos.incidente);
    assert.doesNotMatch(JSON.stringify({registros,datos}),/52662|clave-secreta|domicilio|teléfono/);
  } finally { console.error=original; }
});

test('los mensajes del proveedor separan domicilio, ubicación pública, Drive y notas sin inventar condiciones', async () => {
  const { leerDatosPegados } = await import('../app/admin/datos-pegados.ts');
  const casos = [
    { mensaje: `7824 W Pierson St, Phoenix, AZ 85033
PICTURES
https://drive.google.com/drive/u/0/folders/1p9dWe20kFG32p9DCsdOWNjNW_omC3AVD
Price: $295,000
ARV: $395,000+
Beds: 4
Baths: 2
Sq Ft: 1,681
Lot Size: 6,948 Sq Ft
Year Built: 1973
Gorgeous Home
Great Neighborhood
Occupancy: Vacant at Close
Access: Lockbox`, ciudad: 'Phoenix, AZ 85033', precio: '295000', nota: 'Access: Lockbox' },
    { mensaje: `7923 W Sahuaro Dr, Peoria, AZ 85345
Price: $292,000
ARV: $399,900+
Beds: 3
Baths: 2
Sq Ft: 1,080
Year Built: 1983
HOA: None
Solar: None
Pool: Yes
Occupancy: Vacant`, ciudad: 'Peoria, AZ 85345', precio: '292000', nota: 'Pool: Yes' },
    { mensaje: `1911 N 70th Dr, Phoenix, AZ 85035
Price: $265,000
ARV: $370,000
Beds: 3
Baths: 1
Sq Ft: 1,089
Lot Size: 8,277 Sq Ft
Year Built: 1976
Full Rehab Needed: Flooring, Paint, Windows, Bathrooms, and Popcorn Ceiling Removal
Roof: 10 Years Old (Per Seller)
HVAC: 9 Years Old (Per Seller)
Recommended Garage Conversion into Livable Sq Ft
Electrical Panel Appears to Be in Good Condition
Down Payment: $10,000`, ciudad: 'Phoenix, AZ 85035', precio: '265000', nota: 'Down Payment: $10,000' },
  ];
  for (const caso of casos) {
    const resultado = leerDatosPegados(caso.mensaje);
    assert.equal(resultado.valores.direccionPrivada, caso.mensaje.split('\n')[0]);
    assert.equal(resultado.valores.ciudadZona, caso.ciudad);
    assert.equal(resultado.valores.precio, caso.precio);
    assert.ok(resultado.notasExtra.includes(caso.nota));
    assert.doesNotMatch(resultado.notasExtra, /W Pierson|W Sahuaro|N 70th/);
    assert.equal(resultado.revisar.length, 0);
  }
  assert.ok(leerDatosPegados(casos[0].mensaje).driveUrl.includes('/folders/'));
  assert.equal(leerDatosPegados(casos[1].mensaje).driveUrl, '');
  assert.match(leerDatosPegados(casos[2].mensaje).advertencias.join(' '), /enganche.*revisión/);
  const ambiguo = leerDatosPegados(`${casos[0].mensaje}\n${casos[1].mensaje}`);
  assert.ok(ambiguo.revisar.includes('direccionPrivada'));
  assert.ok(ambiguo.revisar.includes('ciudadZona'));
});

test('el ZIP recupera originales tras la confirmación pública de descarga de Drive', async () => {
  const anterior = globalThis.fetch;
  const clave = process.env.GOOGLE_DRIVE_API_KEY;
  delete process.env.GOOGLE_DRIVE_API_KEY;
  let bloqueado = false;
  let accion = 'https://drive.usercontent.google.com/download';
  let identificador = 'foto-1';
  globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.hostname === 'drive.google.com' && url.pathname === '/uc' && bloqueado) return new Response("Only the owner and editors can download this file.", { headers: { 'content-type': 'text/html' } });
    if (url.hostname === 'drive.google.com' && url.pathname === '/uc') return new Response(`<form id="download-form" action="${accion}" method="get"><input type="hidden" name="id" value="${identificador}"><input type="hidden" name="export" value="download"><input type="hidden" name="confirm" value="codigo-publico"><input type="hidden" name="uuid" value="token-publico"></form>`, { headers: { 'content-type': 'text/html' } });
    if (url.hostname === 'drive.usercontent.google.com') {
      if (url.searchParams.get('uuid') !== 'token-publico') return new Response(null, { status: 403 });
      assert.equal(url.searchParams.get('confirm'), 'codigo-publico');
      assert.equal(url.searchParams.get('resourcekey'), 'clave-foto');
      return new Response(fotoJpeg, { headers: { 'content-type': 'image/jpeg' } });
    }
    return anterior(input, init);
  };
  try {
    const respuesta = await DRIVE(new Request('https://panel.test/api/admin/drive?foto=foto-1&original=1&clave=clave-foto', { headers: { Authorization: `Bearer ${seller}` } }));
    assert.equal(respuesta.status, 200);
    assert.deepEqual(Buffer.from(await respuesta.arrayBuffer()), fotoJpeg);
    for (const caso of [{ accion: 'https://ajeno.test/download', identificador: 'foto-1' },
      { accion: 'https://drive.usercontent.google.com/download', identificador: 'otra-foto' }]) {
      accion = caso.accion; identificador = caso.identificador;
      const rechazo = await DRIVE(new Request('https://panel.test/api/admin/drive?foto=foto-1&original=1&clave=clave-foto', { headers: { Authorization: `Bearer ${seller}` } }));
      assert.equal(rechazo.status, 422);
    }
    bloqueado = true;
    const restringida = await DRIVE(new Request('https://panel.test/api/admin/drive?foto=foto-1&original=1&clave=clave-foto', { headers: { Authorization: `Bearer ${seller}` } }));
    assert.equal(restringida.status, 403);
    assert.match((await restringida.json()).error, /desactivó las descargas/);
  } finally { globalThis.fetch = anterior; if (clave === undefined) delete process.env.GOOGLE_DRIVE_API_KEY; else process.env.GOOGLE_DRIVE_API_KEY = clave; }
});

test('el ZIP de vistas previas conserva resolución, tipo y selección sin pedir originales', async () => {
  const anterior = globalThis.fetch;
  const miniatura = await sharp(fotoJpeg).resize(320, 240, { fit: 'fill' }).jpeg().toBuffer();
  const pedidos = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.hostname === 'drive.google.com' && url.pathname === '/thumbnail') {
      pedidos.push(url.searchParams.get('id'));
      assert.equal(url.searchParams.get('resourcekey'), 'clave-foto');
      return new Response(miniatura, { headers: { 'content-type': 'image/jpeg' } });
    }
    assert.notEqual(url.hostname, 'drive.usercontent.google.com');
    assert.notEqual(url.pathname, '/uc');
    return anterior(input, init);
  };
  try {
    const descargar = (token) => DRIVE(new Request('https://panel.test/api/admin/drive?foto=foto-1&vista=1&clave=clave-foto', { headers: token ? { Authorization: `Bearer ${token}` } : {} }));
    assert.equal((await descargar()).status, 401);
    assert.deepEqual(pedidos, []);
    const { crearZipFotos } = await import('../lib/zip-fotos.ts');
    const zip = await crearZipFotos([{ id: 'foto-1', name: 'Fachada.PNG' }], async () => {
      const respuesta = await descargar(seller);
      assert.equal(respuesta.status, 200);
      return respuesta.blob();
    }, () => {}, true);
    const archivos = unzipSync(new Uint8Array(await zip.arrayBuffer()));
    assert.deepEqual(Object.keys(archivos), ['01 - Fachada - vista previa.jpg']);
    const bytes = Buffer.from(Object.values(archivos)[0]);
    assert.deepEqual(bytes, miniatura);
    const metadata = await sharp(bytes).metadata();
    assert.equal(metadata.width, 320);
    assert.equal(metadata.height, 240);
    assert.deepEqual(pedidos, ['foto-1']);
  } finally { globalThis.fetch = anterior; }
});


test('el ZIP usa la dirección privada como nombre local con un respaldo seguro', async () => {
  const { nombreZipPropiedad } = await import('../lib/zip-fotos.ts');
  const direccion = '3352 W Aire Libre Ave, Phoenix, AZ 85053';
  assert.equal(nombreZipPropiedad(direccion, true), `${direccion}.zip`);
  assert.equal(nombreZipPropiedad(direccion), `${direccion}.zip`);
  assert.equal(nombreZipPropiedad('Peoria, AZ 85345'), 'Peoria, AZ 85345.zip');
  assert.equal(nombreZipPropiedad(undefined, true), 'vistas-previas-facebook.zip');
  assert.equal(nombreZipPropiedad(''), 'fotos-originales.zip');
  assert.doesNotMatch(nombreZipPropiedad('../Casa/privada'), /[\\/]/);
  assert.equal(nombreZipPropiedad('Casa.zip'), 'Casa.zip');
});
