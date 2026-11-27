import { expect, test } from '@playwright/test';

const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/propiedades/*/fotos', (ruta) => ruta.fulfill({ json: { fotos: [] } }));
});

test('la captación conserva el formulario tras un límite y permite reintentar', async ({ page }) => {
  await page.route('**/api/catalogo**', (ruta) => ruta.fulfill({ json: { propiedades:[],total:0,pagina:0,porPagina:12 } }));
  let intentos = 0;
  await page.route('**/api/casas-ofrecidas', async (ruta) => {
    const datos = ruta.request().postDataJSON();
    expect(datos.nombre).toBe('Propietario');
    expect(datos.sitio_web).toBe('');
    intentos++;
    await ruta.fulfill({ status: intentos === 1 ? 429 : 201,
      json: intentos === 1 ? { error: 'Intenta nuevamente más tarde.' } : { ok: true } });
  });
  await page.goto('/');
  const form = page.locator('#vende-tu-casa form');
  await form.getByLabel('Nombre del propietario').fill('Propietario');
  await form.getByLabel('Ciudad o ZIP').fill('Peoria');
  await form.getByLabel('País del teléfono').selectOption('US');
  await form.getByLabel('Número de WhatsApp').fill('6025550123');
  await form.getByRole('button', { name: 'Ofrecer mi propiedad' }).click();
  await expect(form.getByRole('alert')).toHaveText('Intenta nuevamente más tarde.');
  await expect(form.getByLabel('Nombre del propietario')).toHaveValue('Propietario');
  await form.getByRole('button', { name: 'Ofrecer mi propiedad' }).click();
  await expect(page.locator('#vende-tu-casa [role=status]')).toBeVisible();
  expect(intentos).toBe(2);
});

test('el ZIP se edita y un conflicto conserva los cambios de un borrador', async ({ page }) => {
  await page.addInitScript(({ id }) => {
    localStorage.setItem('phoenix-admin-auth', JSON.stringify({
      access_token: 'sesion-e2e', refresh_token: 'refresh-e2e', expires_at: Math.floor(Date.now() / 1000) + 3600,
      token_type: 'bearer', user: { id, email: 'test@example.test', aud: 'authenticated', role: 'authenticated' },
    }));
  }, { id });
  await page.route('https://supabase.test/**', (ruta) => ruta.fulfill({ json: { id } }));
  const ficha = { id, ficha_version: 4, ciudad_zona: 'Peoria, AZ 85345', precio: 292000,
    direccion_privada: '123 Privada', estado: 'disponible', publicada_en: null,
    fotos_drive: [], condiciones_texto: {}, textos_version: 0 };
  await page.route('**/api/admin/propiedades**', async (ruta) => {
    if (ruta.request().method() === 'PATCH') {
      const body = ruta.request().postDataJSON();
      expect(body.ficha_version).toBe(4);
      expect(body.ficha.ciudad_zona).toBe('Peoria, AZ 85281');
      await ruta.fulfill({ status: 409, json: { error: 'Otra sesión cambió esta ficha.' } });
    } else await ruta.fulfill({ json: { propiedades: ruta.request().url().includes('por_confirmar') ? [] : [ficha], hayMas: false } });
  });
  await page.goto('/admin');
  await page.getByRole('link', { name: 'Editar borrador' }).click();
  await page.getByLabel('ZIP público').fill('');
  await page.getByLabel('ZIP público').pressSequentially('85281');
  await expect(page.getByLabel('Zona pública')).toHaveValue('Peoria');
  await page.getByRole('button', { name: 'Guardar borrador', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Otra sesión cambió esta ficha.' })).toHaveText('Otra sesión cambió esta ficha.');
  await expect(page.getByLabel('ZIP público')).toHaveValue('85281');
  await expect(page.getByLabel('Dirección exacta')).toHaveValue('123 Privada');
});

test('el catálogo pagina, combina filtros y actualiza los resultados al recuperar el foco', async ({ page }) => {
  let retiradas = false;
  const consultas: URL[] = [];
  await page.route('**/api/catalogo**', async (ruta) => {
    const url = new URL(ruta.request().url());
    consultas.push(url);
    const pagina = Number(url.searchParams.get('pagina'));
    const ciudad = url.searchParams.get('ciudad');
    const zip = url.searchParams.get('zip');
    const total = retiradas ? 0 : ciudad ? 5 : 25;
    const propiedades = Array.from({ length: Math.max(0, Math.min(12,total-pagina*12)) }, (_,i) => ({
      id:`casa-${pagina*12+i}`,ciudad_zona:`${ciudad || 'Peoria'}, AZ ${zip || '85345'}`,precio:292000,
      estado:'disponible',ultima_confirmacion:new Date().toISOString(),tiene_portada_drive:false,
    }));
    await ruta.fulfill({ json: { propiedades,total,pagina,porPagina:12 } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Actualizar catálogo' }).click();
  await expect(page.locator('.property-card')).toHaveCount(12);
  await expect(page.getByText('25 resultados')).toBeVisible();
  await page.getByRole('button',{ name:'Siguiente',exact:true }).click();
  await expect(page.getByText('Página 2 de 3')).toBeVisible();
  await page.getByRole('combobox',{ name:'Ciudad',exact:true }).fill('Mesa');
  await page.getByRole('option', { name: 'Mesa', exact: true }).click();
  await page.getByRole('textbox',{ name:'ZIP',exact:true }).fill('852');
  await expect(page.locator('.property-card')).toHaveCount(5);
  await expect.poll(() => consultas.at(-1)?.searchParams.get('zip')).toBe('852');
  expect(consultas.at(-1)?.searchParams.get('ciudad')).toBe('Mesa');
  expect(consultas.at(-1)?.searchParams.get('pagina')).toBe('0');
  retiradas=true;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByText('0 resultados')).toBeVisible();
  await expect(page.locator('.property-card')).toHaveCount(0);
  await expect(page.getByText('Por ahora no hay casas disponibles con estos filtros.')).toBeVisible();
});

test('la publicación exige preparar, cargar y revisar las copias públicas', async ({ page }) => {
  await page.addInitScript(({ id }) => {
    localStorage.setItem('phoenix-admin-auth',JSON.stringify({access_token:'sesion-e2e',refresh_token:'refresh-e2e',
      expires_at:Math.floor(Date.now()/1000)+3600,token_type:'bearer',user:{id,email:'test@example.test',aud:'authenticated',role:'authenticated'}}));
  },{id});
  await page.route('https://supabase.test/**',(ruta) => ruta.fulfill({json:{id}}));
  const foto = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const ficha = {id,ficha_version:2,ciudad_zona:'Peoria, AZ 85345',precio:292000,estado:'disponible',publicada_en:null as string|null,
    direccion_privada:'123 Privada',fotos_drive:[{id:'foto-1',name:'Sala.jpg'}],portada_drive_id:'foto-1',drive_url:'https://drive.google.com/drive/folders/privada',
    imagen_portada:null,condiciones_texto:{},textos_version:0};
  let publicado = false;
  const origenes: string[] = [];
  page.on('request',(request) => origenes.push(request.url()));
  await page.route('**/api/admin/propiedades**',async (ruta) => {
    if (ruta.request().method()==='PATCH') {
      const body=ruta.request().postDataJSON();
      expect(body.material_revisado).toBe(true);
      expect(body.ficha_version).toBe(2);
      expect(body.portada_publica_id).toBe(foto);
      expect(body.galeria_publica_ids).toEqual([foto]);
      publicado=true; ficha.publicada_en=new Date().toISOString(); ficha.ficha_version++;
      await ruta.fulfill({json:{ok:true}});
    } else await ruta.fulfill({json:{propiedades:ruta.request().url().includes('por_confirmar')?[]:[ficha],hayMas:false}});
  });
  await page.route('**/api/admin/material-publico**',async (ruta) => {
    if (ruta.request().method()==='POST') await ruta.fulfill({json:{id:foto,fuente:'foto-1'}});
    else await ruta.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aHZkAAAAASUVORK5CYII=','base64')});
  });
  await page.goto('/admin');
  await page.getByRole('button',{name:'Revisar ficha y fotos',exact:true}).click();
  const revision=page.getByRole('region',{name:'Revisión de fotos públicas'});
  const publicar=revision.getByRole('button',{name:'Confirmar revisión y publicar',exact:true});
  await expect(publicar).toBeDisabled();
  await revision.getByRole('button',{name:'Preparar fotos públicas',exact:true}).click();
  const confirmar=revision.getByLabel('Revisé las fotos públicas y ocultan el domicilio.');
  await expect(confirmar).toBeEnabled();
  await confirmar.check();
  await expect(publicar).toBeEnabled();
  await publicar.click();
  await expect.poll(() => publicado).toBe(true);
  expect(origenes.some((url) => url.startsWith('https://drive.google.com'))).toBe(false);
});

test('el registro VIP conserva la indicación financiera que se muestra en el panel', async ({ page }) => {
  await page.addInitScript(({ id }) => {
    localStorage.setItem('phoenix-admin-auth', JSON.stringify({
      access_token: 'sesion-e2e', refresh_token: 'refresh-e2e', expires_at: Math.floor(Date.now() / 1000) + 3600,
      token_type: 'bearer', user: { id, email: 'test@example.test', aud: 'authenticated', role: 'authenticated' },
    }));
  }, { id });
  await page.route('https://supabase.test/**', (ruta) => ruta.fulfill({ json: { id } }));
  await page.route('**/api/catalogo**', (ruta) => ruta.fulfill({ json: { propiedades: [], total: 0, pagina: 0, porPagina: 12 } }));
  await page.route('**/api/admin/propiedades**', (ruta) => ruta.fulfill({ json: { propiedades: [], hayMas: false } }));
  const compradores: Record<string, unknown>[] = [];
  await page.route('**/api/compradores-vip', (ruta) => {
    compradores.push({ id: compradores.length + 1, ...ruta.request().postDataJSON() });
    return ruta.fulfill({ status: 201, json: { ok: true } });
  });
  await page.route('**/api/admin/compradores-vip**', (ruta) => ruta.fulfill({ json: { compradores, hayMas: false } }));
  for (const [nombre, tieneItin] of [['Ana Pérez', true], ['Luis Pérez', false]] as const) {
    await page.goto('/');
    const vip = page.locator('#lista-vip');
    await vip.getByLabel('Tu nombre completo').fill(nombre);
    await vip.getByLabel('País del número de WhatsApp').selectOption('US');
    await vip.getByLabel('Tu número de WhatsApp').fill('6025550123');
    await vip.getByRole('checkbox', { name: 'Cuento con ITIN, pasaporte o enganche disponible.' }).setChecked(tieneItin);
    await vip.getByRole('button', { name: 'Unirme a la Lista Prioritaria' }).click();
    await expect(vip.getByText('Ya quedaste registrado', { exact: false })).toBeVisible();
    expect(compradores.at(-1)?.tiene_itin).toBe(tieneItin);
  }
  await page.goto('/admin');
  const vipAdmin = page.getByRole('region', { name: 'Compradores VIP' });
  await vipAdmin.getByRole('button', { name: 'Ver compradores' }).click();
  await expect(vipAdmin.getByRole('listitem').filter({ hasText: 'Ana Pérez' })).toContainText('Indicó ITIN, pasaporte o enganche');
  await expect(vipAdmin.getByRole('listitem').filter({ hasText: 'Luis Pérez' })).toContainText('Sin indicación de ITIN, pasaporte o enganche');
});

test('la galería del catálogo conserva la URL de portada al cargar las demás fotos', async ({ page }) => {
  const base = '/api/propiedades/casa-fotos';
  const portada = `${base}/portada`;
  const lateral = `${base}/fotos/lateral`;
  const imagenes: string[] = [];
  let entregarGaleria!: () => void;
  const galeriaLista = new Promise<void>((resolve) => { entregarGaleria = resolve; });
  await page.route('**/api/catalogo**', (ruta) => ruta.fulfill({ json: {
    total: 1, pagina: 0, porPagina: 12,
    propiedades: [{ id: 'casa-fotos', ciudad_zona: 'Peoria', precio: 292000, estado: 'disponible', tiene_portada_drive: true }],
  } }));
  await page.route(`**${base}/fotos`, async (ruta) => {
    await galeriaLista;
    await ruta.fulfill({ json: { portada, fotos: [lateral, portada] } });
  });
  await page.route(/\/api\/propiedades\/casa-fotos\/(portada|fotos\/.+)$/, (ruta) => {
    imagenes.push(new URL(ruta.request().url()).pathname);
    return ruta.fulfill({ contentType: 'image/png',
      body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aHZkAAAAASUVORK5CYII=', 'base64') });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Actualizar catálogo' }).click();
  const galeria = page.getByRole('region', { name: 'Fotos de Peoria' });
  await galeria.scrollIntoViewIfNeeded();
  await expect.poll(() => imagenes).toEqual([portada]);
  entregarGaleria();
  const siguiente = galeria.getByRole('button', { name: 'Foto siguiente' });
  await expect(siguiente).toBeVisible();
  await expect(galeria.getByRole('img')).toHaveAttribute('src', portada);
  await siguiente.click();
  await expect.poll(() => imagenes).toEqual([portada, lateral]);
});

test('confirmar disponibilidad conserva la página y marca el aviso preparado como desactualizado', async ({ page }) => {
  await page.addInitScript(({ id }) => {
    localStorage.setItem('phoenix-admin-auth', JSON.stringify({
      access_token: 'sesion-e2e', refresh_token: 'refresh-e2e', expires_at: Math.floor(Date.now() / 1000) + 3600,
      token_type: 'bearer', user: { id, email: 'test@example.test', aud: 'authenticated', role: 'authenticated' },
    }));
  }, { id });
  let confirmada = false;
  const paginas: number[] = [];
  const ficha = { id, ciudad_zona: 'Peoria', precio: 292000, estado: 'disponible', ultima_confirmacion: null };
  const reemplazo = { ...ficha, ciudad_zona: 'Mesa' };
  await page.route('https://supabase.test/**', (ruta) => ruta.fulfill({
    json: new URL(ruta.request().url()).pathname === '/rest/v1/propiedades_publicas' ? [confirmada ? reemplazo : ficha] : { id },
  }));
  await page.route('**/api/admin/propiedades**', (ruta) => {
    const url = new URL(ruta.request().url());
    if (ruta.request().method() === 'PATCH') {
      confirmada = true;
      return ruta.fulfill({ json: { disponibilidad: {
        estado: 'disponible', ultima_confirmacion: new Date().toISOString(), ficha_version: 1,
      } } });
    }
    if (url.searchParams.get('vista') !== 'por_confirmar') return ruta.fulfill({ json: { propiedades: [], hayMas: false } });
    const pagina = Number(url.searchParams.get('pagina'));
    paginas.push(pagina);
    return ruta.fulfill({ json: {
      propiedades: [confirmada ? reemplazo : ficha], hayMas: pagina === 0,
    } });
  });
  await page.goto('/admin');
  const cola = page.getByRole('region', { name: 'Por confirmar' });
  await cola.getByRole('button', { name: 'Siguiente' }).click();
  const aviso = page.getByRole('region', { name: 'Aviso diario de WhatsApp' });
  await aviso.getByRole('button', { name: 'Preparar aviso' }).click();
  const vistaPrevia = aviso.getByRole('textbox', { name: 'Vista previa del aviso de WhatsApp' });
  await expect(vistaPrevia).toHaveValue(/Peoria/);
  const texto = await vistaPrevia.inputValue();
  const consultasAntesDeFoco = [...paginas];
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(cola.getByText('Página 2')).toBeVisible();
  expect(paginas).toEqual(consultasAntesDeFoco);
  await cola.getByRole('button', { name: 'Confirmar disponible' }).click();
  await expect(cola.getByText('Mesa')).toBeVisible();
  await expect(cola.getByText('Página 2')).toBeVisible();
  expect(paginas.at(-1)).toBe(1);
  await expect(aviso.getByText('El inventario cambió.', { exact: false })).toBeVisible();
  await expect(vistaPrevia).toHaveValue(texto);
  await aviso.getByRole('button', { name: 'Actualizar aviso' }).click();
  await expect(vistaPrevia).toHaveValue(/Mesa/);
  await expect(aviso.getByText('El inventario cambió.', { exact: false })).toHaveCount(0);
});

test('el catálogo trae propiedades y métricas en el HTML sin una petición inicial del navegador', async ({ page, request }) => {
  const respuesta = await request.get('/');
  expect(respuesta.ok()).toBe(true);
  const html = await respuesta.text();
  expect(html).toContain('class="property-card');
  expect(html).toContain('Peoria, AZ 85345');
  expect(html).toContain('Precio desde');
  const consultas: string[] = [];
  await page.route('**/api/catalogo**', (ruta) => {
    consultas.push(ruta.request().url());
    return ruta.fulfill({ json: { propiedades: [], total: 0, pagina: 0, porPagina: 12 } });
  });
  await page.goto('/');
  await expect(page.locator('.property-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Actualizar catálogo' }).click();
  await expect(page.locator('.property-card')).toHaveCount(0);
  expect(consultas).toHaveLength(1);
});

test('la ficha publica metadatos de venta y muestra alternativas al retirarse', async ({ page, request }) => {
  const ruta = '/propiedades/ficha-servidor';
  const respuesta = await request.get(ruta, { headers: { 'User-Agent': 'facebookexternalhit/1.1' } });
  const html = await respuesta.text();
  expect(html).toContain('<meta property="og:title" content="Peoria, AZ 85345 · $292,000 USD"');
  expect(html).toMatch(/<meta property="og:image" content="https?:\/\/[^"]+\/api\/propiedades\/ficha-servidor\/portada"/);
  expect(html).toContain('>Por confirmar</p>');
  await page.goto(ruta);
  await expect(page.getByRole('heading', { name: 'Peoria, AZ 85345' })).toBeVisible();
  await expect(page.getByText('Por confirmar', { exact: true })).toBeVisible();
  const portada = page.getByRole('img', { name: /Foto 1 de Peoria/ });
  await expect.poll(() => portada.evaluate((imagen) => (imagen as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await page.goto('/propiedades/ficha-retirada');
  await expect(page.getByText('Esta propiedad salió del inventario.')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Casas disponibles en la zona' }).getByRole('link')).toHaveAttribute('href', '/propiedades/ficha-similar');
  await expect(page.locator('meta[property="og:image"]')).toHaveCount(0);
});

test('corregir el precio conserva el borrador y recargar aplica las condiciones de otra sesión', async ({ page }) => {
  await page.addInitScript(({ id }) => {
    localStorage.setItem('phoenix-admin-auth', JSON.stringify({
      access_token: 'sesion-e2e', refresh_token: 'refresh-e2e', expires_at: Math.floor(Date.now() / 1000) + 3600,
      token_type: 'bearer', user: { id, email: 'test@example.test', aud: 'authenticated', role: 'authenticated' },
    }));
  }, { id });
  await page.route('https://supabase.test/**', (ruta) => ruta.fulfill({ json: { id } }));
  let ficha = {
    id, ficha_version: 4, ciudad_zona: 'Peoria, AZ 85345', precio: 292000,
    direccion_privada: '123 Privada', estado: 'disponible', publicada_en: new Date().toISOString(),
    fotos_drive: [], condiciones_texto: { enganche: 10 }, textos_version: 1,
    script_fb_es: 'Anuncio guardado', script_fb_es_aprobado: true,
  };
  await page.route('**/api/admin/propiedades**', (ruta) => {
    if (ruta.request().method() === 'PATCH') {
      expect(ruta.request().postDataJSON()).toMatchObject({ accion: 'corregir_precio', precio: 300000, precio_anterior: 292000 });
      const cambios = { precio: 300000, ficha_version: 5, textos_version: 2, script_fb_es_aprobado: false };
      ficha = { ...ficha, ...cambios };
      return ruta.fulfill({ json: { ficha: cambios } });
    }
    return ruta.fulfill({ json: { propiedades: ruta.request().url().includes('por_confirmar') ? [] : [ficha], hayMas: false } });
  });
  await page.goto('/admin');
  await page.getByText('Textos de la propiedad', { exact: true }).click();
  const enganche = page.getByLabel('Enganche (%)', { exact: true });
  const borrador = page.getByRole('textbox', { name: /Facebook.*español/i });
  await expect(enganche).toHaveValue('10');
  await borrador.fill('Edición que aún no se guardó');
  await enganche.fill('15');
  await page.getByText('Corregir precio', { exact: true }).click();
  await page.getByLabel('Nuevo precio en USD').fill('300000');
  await page.getByRole('button', { name: 'Guardar precio' }).click();
  await expect(page.getByText('Precio actualizado.', { exact: false })).toBeVisible();
  await expect(borrador).toHaveValue('Edición que aún no se guardó');
  await expect(enganche).toHaveValue('15');
  ficha = { ...ficha, condiciones_texto: { enganche: 20 }, textos_version: 3 };
  await page.getByRole('button', { name: 'Recargar inventario' }).click();
  await expect(enganche).toHaveValue('20');
  await expect(borrador).toHaveValue('Edición que aún no se guardó');
});

test('el vendedor consulta una casa ofrecida y actualiza su estado', async ({ page }) => {
  await page.addInitScript(({ id }) => {
    localStorage.setItem('phoenix-admin-auth', JSON.stringify({
      access_token: 'sesion-e2e', refresh_token: 'refresh-e2e', expires_at: Math.floor(Date.now() / 1000) + 3600,
      token_type: 'bearer', user: { id, email: 'test@example.test', aud: 'authenticated', role: 'authenticated' },
    }));
  }, { id });
  await page.route('https://supabase.test/**', (ruta) => ruta.fulfill({ json: { id } }));
  await page.route('**/api/admin/propiedades**', (ruta) => ruta.fulfill({ json: { propiedades: [], hayMas: false } }));
  let casa = { id, nombre: 'Propietario de prueba', zona: 'Mesa', whatsapp: '+16025550123',
    condicion: 'habitable', estado: 'nueva', precio_esperado: 225000 };
  await page.route('**/api/admin/casas-ofrecidas**', (ruta) => {
    if (ruta.request().method() === 'PATCH') {
      expect(ruta.request().postDataJSON()).toEqual({ id, estado: 'contactada' });
      casa = { ...casa, estado: 'contactada' };
      return ruta.fulfill({ json: { casa } });
    }
    return ruta.fulfill({ json: { casas: [casa], hayMas: false } });
  });
  await page.goto('/admin');
  const ofertas = page.getByRole('region', { name: 'Casas ofrecidas' });
  await ofertas.getByRole('button', { name: 'Ver casas ofrecidas' }).click();
  await expect(ofertas.getByText('Propietario de prueba', { exact: false })).toBeVisible();
  await ofertas.getByLabel('Estado de la oferta').selectOption('contactada');
  await expect(ofertas.getByRole('status')).toHaveText('Estado actualizado.');
  await expect(ofertas.getByLabel('Estado de la oferta')).toHaveValue('contactada');
});
