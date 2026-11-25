begin;

-- Campos derivados: las integraciones conservan ciudad_zona como entrada.
-- Los valores originales se conservan para revisar ubicaciones ambiguas.
create function public.ciudad_del_catalogo(zona text)
returns text language sql immutable strict set search_path = '' as $$
  select ciudad from unnest(array[
    'Apache Junction','Avondale','Buckeye','Carefree','Casa Grande','Cave Creek',
    'Chandler','El Mirage','Florence','Fountain Hills','Gilbert','Glendale',
    'Goodyear','Guadalupe','Litchfield Park','Maricopa','Mesa','Paradise Valley',
    'Peoria','Phoenix','Queen Creek','Scottsdale','Surprise','Tempe','Tolleson',
    'Wickenburg','Youngtown'
  ]) as opciones(ciudad)
  where lower(ciudad) = lower(btrim(regexp_replace(
    regexp_replace(btrim(zona), '[,[:space:]]*[0-9]{5}(-[0-9]{4})?$', ''),
    '(,[[:space:]]*|[[:space:]]+)(AZ|Arizona)$', '', 'i')))
$$;

alter table public.propiedades
  add column ciudad text generated always as (public.ciudad_del_catalogo(ciudad_zona)) stored,
  add column zip text generated always as (substring(ciudad_zona from '([0-9]{5})(?:-[0-9]{4})?$')) stored;

grant select (ciudad, zip) on public.propiedades to anon, authenticated;

create or replace view public.propiedades_publicas
  with (security_invoker = true, security_barrier = true) as
select id, ciudad_zona, precio, arv, beds, baths, sqft, lot_size, year_built,
       drive_url, imagen_portada, estado, created_at, tiene_portada_drive,
       ultima_confirmacion, ciudad, zip
from public.propiedades where publicada_en is not null;

-- Ejecutar después para localizar las fichas que requieren revisión manual.
-- select id, ciudad_zona from public.propiedades where ciudad is null;
notify pgrst, 'reload schema';
commit;
