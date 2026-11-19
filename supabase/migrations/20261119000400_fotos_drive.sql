begin;

alter table public.propiedades
  add column fotos_drive jsonb not null default '[]'::jsonb,
  add column portada_drive_id text,
  add column tiene_portada_drive boolean generated always as (portada_drive_id is not null) stored,
  add constraint propiedades_fotos_drive_validas check (
    jsonb_typeof(fotos_drive) = 'array'
    and (portada_drive_id is null or (
      nullif(btrim(drive_url), '') is not null
      and fotos_drive @> jsonb_build_array(jsonb_build_object('id', portada_drive_id))
    ))
  ),
  drop constraint propiedades_publicacion_completa;

alter table public.propiedades
  add constraint propiedades_publicacion_completa check (
    publicada_en is null or (
      nullif(btrim(ciudad_zona), '') is not null
      and precio is not null and precio > 0
      and precio::text not in ('NaN', 'Infinity', '-Infinity')
      and (portada_drive_id is not null or (
        imagen_portada is not null and imagen_portada ~* '^https?://[^[:space:]]+$'
      ))
    )
  );

-- Los identificadores, nombres y claves de las fotos siguen siendo privados.
revoke select (fotos_drive, portada_drive_id) on public.propiedades from public, anon, authenticated;
grant select (tiene_portada_drive) on public.propiedades to anon, authenticated;

create or replace view public.propiedades_publicas
  with (security_invoker = true, security_barrier = true)
as
select id, ciudad_zona, precio, arv, beds, baths, sqft, lot_size, year_built,
       drive_url, imagen_portada, estado, created_at, tiene_portada_drive
from public.propiedades
where publicada_en is not null;

notify pgrst, 'reload schema';
commit;
