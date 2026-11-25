import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const migrations = new URL('../supabase/migrations/', import.meta.url);

test('la cadena completa crea una base vacía y aplica RLS, versiones, triggers y captación atómica', async () => {
  const db = new PGlite();
  try {
    await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
    for (const archivo of (await readdir(migrations)).filter((f) => f.endsWith('.sql')).sort()) {
      await db.exec(await readFile(new URL(archivo, migrations), 'utf8'));
    }
    await db.exec("insert into propiedades(direccion_privada,ciudad_zona,precio,imagen_portada) values ('Privada 123','Peoria, AZ 85345',292000,'https://example.test/casa.jpg')");
    const id = (await db.query('select id from propiedades')).rows[0].id;
    await db.exec('set role service_role');
    const una = await db.query('update propiedades set notas_extra=$1 where id=$2 and ficha_version=0 returning ficha_version', ['Primera pestaña',id]);
    assert.equal(una.rows[0].ficha_version, 1);
    const otra = await db.query('update propiedades set notas_extra=$1 where id=$2 and ficha_version=0 returning id', ['Pestaña antigua',id]);
    assert.equal(otra.rows.length, 0);
    const preparacion = await db.query('select * from reservar_material($1,1,$2)', [id,'portada-alternativa']);
    const copia = preparacion.rows[0].id;
    assert.equal((await db.query('select * from reservar_material($1,1,$2)', [id,'portada-alternativa'])).rows.length,0);
    assert.equal((await db.query('select * from reservar_material($1,999,$2)', [id,'portada-alternativa'])).rows.length,0);
    await assert.rejects(db.query('update propiedades set publicada_en=now() where id=$1',[id]), /Prepara y revisa/);
    const reserva = (await db.query('select * from reservar_material($1,1,$2)',[id,'otra-foto'])).rows[0];
    await db.query("update material_publico set vence=now()-interval '1 minute' where id=$1",[reserva.id]);
    const reemplazo = (await db.query('select * from reservar_material($1,1,$2)',[id,'otra-foto'])).rows[0];
    assert.equal(reemplazo.id,reserva.id);
    assert.notEqual(reemplazo.token,reserva.token);
    assert.equal((await db.query("update material_publico set contenido=decode('ab','hex') where id=$1 and token=$2 returning id",[reserva.id,reserva.token])).rows.length,0);
    await db.query("update material_publico set contenido=decode('52494646','hex'),contenido_hash=repeat('a',64) where id=$1",[copia]);
    await db.query('update propiedades set publicada_en=now(),script_fb_es=$1,script_fb_es_aprobado=true,portada_publica_id=$3,galeria_publica_ids=array[$3]::uuid[] where id=$2', ['Texto aprobado',id,copia]);
    await db.query('update propiedades set precio=300000 where id=$1', [id]);
    assert.equal((await db.query('select script_fb_es_aprobado from propiedades')).rows[0].script_fb_es_aprobado, false);
    await db.exec('reset role; set role anon');
    assert.equal((await db.query('select ciudad_zona from propiedades_publicas')).rows.length, 1);
    assert.deepEqual((await db.query('select drive_url,imagen_portada from propiedades_publicas')).rows[0],{drive_url:null,imagen_portada:null});
    for (const sql of ['select direccion_privada from propiedades', 'select * from leads_compradores', 'select * from casas_ofrecidas', 'select portada_webp from propiedades', 'select * from envios_publicos', 'select * from material_publico', 'select drive_url from propiedades']) {
      await assert.rejects(db.query(sql), /permission denied/);
    }
    await assert.rejects(db.query("select registrar_envio_publico('vip',$1,$2,'{}')", ['a'.repeat(64),'b'.repeat(64)]), /permission denied/);
    await db.exec('reset role; set role authenticated');
    assert.equal((await db.query('select ciudad_zona from propiedades_publicas')).rows.length, 1);
    for (const sql of ['select direccion_privada from propiedades','select * from leads_compradores','select * from casas_ofrecidas','select portada_webp from propiedades']) {
      await assert.rejects(db.query(sql), /permission denied/);
    }
    await db.exec('reset role; set role service_role');
    await db.query('update propiedades set publicada_en=null where id=$1', [id]);
    await db.exec('reset role; set role anon');
    assert.equal((await db.query('select id from propiedades_publicas')).rows.length, 0);
    await db.exec('reset role; set role service_role');
    const telefono = 'c'.repeat(64);
    const enviar = (canal, clave, datos, contacto = telefono) => db.query('select registrar_envio_publico($1,$2,$3,$4) as resultado', [canal,clave,contacto,JSON.stringify(datos)]);
    const datos = { nombre:'Comprador', whatsapp:'+16025550123',perfil:'inversionista',tiene_itin:true };
    const envios = await Promise.all([enviar('vip','a'.repeat(64),datos), enviar('vip','a'.repeat(64),datos)]);
    assert.deepEqual(envios.map((r) => r.rows[0].resultado).sort(), ['registrado','repetido']);
    assert.equal((await db.query('select count(*)::int as total from leads_compradores')).rows[0].total, 1);
    await enviar('vip','b'.repeat(64),{...datos,nombre:'Nombre corregido'});
    assert.equal((await db.query('select nombre from leads_compradores')).rows[0].nombre, 'Nombre corregido');
    const casa = { nombre:'Dueño',whatsapp:'+16025550123',zona:'Mesa',condicion:'habitable' };
    assert.equal((await enviar('casa','d'.repeat(64),casa)).rows[0].resultado, 'registrado');
    assert.equal((await enviar('casa','e'.repeat(64),{...casa,zona:'Peoria'})).rows[0].resultado, 'registrado');
    await enviar('casa','f'.repeat(64),{...casa,zona:'Tempe'});
    assert.equal((await enviar('casa','1'.repeat(64),{...casa,zona:'Phoenix'})).rows[0].resultado, 'limitado');
    assert.equal((await db.query('select count(*)::int as total from casas_ofrecidas')).rows[0].total, 3);
    // Al fallar una escritura real, ni su clave ni su cuota quedan consumidas.
    await assert.rejects(enviar('casa','2'.repeat(64),{...casa,nombre:null},'9'.repeat(64)), /null value/);
    assert.equal((await enviar('casa','2'.repeat(64),casa,'9'.repeat(64))).rows[0].resultado,'registrado');
    await db.exec("reset role; update envios_publicos set creado_en=now()-interval '25 hours'");
    await db.exec('set role service_role');
    assert.equal((await enviar('vip','a'.repeat(64),datos)).rows[0].resultado,'registrado');
    await db.exec(`reset role;
      insert into envios_publicos(canal,clave,contacto)
      select 'vip',lpad(i::text,64,'0'),repeat('8',64) from generate_series(1000,1298) i;
      set role service_role;`);
    assert.equal((await enviar('casa','7'.repeat(64),casa,'6'.repeat(64))).rows[0].resultado,'limitado');
  } finally {
    await db.close();
  }
});
