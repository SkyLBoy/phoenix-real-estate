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
