-- Inspección opcional: estas dos consultas se pueden ejecutar por separado
-- ANTES de aplicar la migración, con el rol del SQL Editor.
-- select id, ciudad_zona from public.propiedades where publicada_en is not null and (
--   ciudad_zona is null or char_length(ciudad_zona) > 100 or btrim(ciudad_zona) collate "C" !~
--   '^(?:[0-9]{5}(?:-[0-9]{4})?|[A-Za-zÀ-ÖØ-öø-ÿ]+(?:(?:\.? |[’''-])[A-Za-zÀ-ÖØ-öø-ÿ]+)*(?:, (?:[Aa][Zz]|[Aa][Rr][Ii][Zz][Oo][Nn][Aa]))?(?:,? [0-9]{5}(?:-[0-9]{4})?)?)$');
-- select id, ciudad_zona, publicada_en from public.propiedades
-- where estado = 'disponible' and publicada_en = ultima_confirmacion;

begin;

-- El formato debe coincidir con esZonaPublica, en lib/zona-publica.ts.
create function public.es_zona_publica(zona text)
returns boolean
language sql immutable strict
set search_path = ''
as $$
  select char_length(zona) <= 100 and btrim(zona) collate "C" ~
    '^(?:[0-9]{5}(?:-[0-9]{4})?|[A-Za-zÀ-ÖØ-öø-ÿ]+(?:(?:\.? |[’''-])[A-Za-zÀ-ÖØ-öø-ÿ]+)*(?:, (?:[Aa][Zz]|[Aa][Rr][Ii][Zz][Oo][Nn][Aa]))?(?:,? [0-9]{5}(?:-[0-9]{4})?)?)$'
$$;

-- Antes, publicar grababa el mismo instante en ambas columnas. Una
-- reconfirmación posterior tiene su propio instante y se conserva.
update public.propiedades set ultima_confirmacion = null
where estado = 'disponible' and publicada_en = ultima_confirmacion;

-- Las fichas con ubicación a corregir quedan en el panel con el mismo ID.
update public.propiedades set publicada_en = null
where publicada_en is not null and public.es_zona_publica(ciudad_zona) is not true;

alter table public.propiedades
  add constraint propiedades_zona_publicada_valida check (
    publicada_en is null or public.es_zona_publica(ciudad_zona) is true
  ),
  add column revision_desde timestamptz
    generated always as (coalesce(ultima_confirmacion, publicada_en)) stored;

create index propiedades_revision_pendiente on public.propiedades (revision_desde, id)
  where publicada_en is not null and estado = 'disponible';

notify pgrst, 'reload schema';
commit;
