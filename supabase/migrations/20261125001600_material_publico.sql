begin;
alter table public.propiedades drop constraint portada_webp_valida;
alter table public.propiedades add constraint portada_webp_valida check (
  portada_webp is null or octet_length(portada_webp) between 1 and 2097152
),
  add column portada_publica_id uuid,
  add column galeria_publica_ids uuid[] not null default '{}',
  add column portada_legacy_hash text generated always as (md5(portada_webp)) stored;

create table public.material_publico (
  id uuid primary key default gen_random_uuid(),
  propiedad_id text not null,
  ficha_version integer not null,
  fuente text not null,
  token uuid not null default gen_random_uuid(),
  vence timestamptz not null default now() + interval '90 seconds',
  contenido bytea check (octet_length(contenido) between 1 and 2097152),
  contenido_hash text,
  unique (propiedad_id, ficha_version, fuente)
);
alter table public.material_publico enable row level security;
revoke all on public.material_publico from public, anon, authenticated;
grant select, insert, update, delete on public.material_publico to service_role;
revoke all privileges (portada_publica_id,galeria_publica_ids,portada_legacy_hash) on public.propiedades from public,anon,authenticated;

create function public.reservar_material(propiedad text, version integer, origen text)
returns table(id uuid, token uuid) language plpgsql security definer set search_path = '' as $$
begin
  delete from public.material_publico m using public.propiedades p
  where p.id::text=propiedad and m.propiedad_id=propiedad
    and m.id is distinct from p.portada_publica_id and not(m.id=any(p.galeria_publica_ids))
    and (m.ficha_version <> p.ficha_version or m.vence < now()-interval '24 hours');
  return query
  insert into public.material_publico(propiedad_id,ficha_version,fuente)
  select p.id::text,version,origen from public.propiedades p
  where p.id::text=propiedad and p.ficha_version=version
  on conflict on constraint material_publico_propiedad_id_ficha_version_fuente_key do update
    set token=gen_random_uuid(),vence=now()+interval '90 seconds'
    where material_publico.contenido is null and material_publico.vence < now()
  returning material_publico.id,material_publico.token;
end;
$$;
revoke all on function public.reservar_material(text,integer,text) from public,anon,authenticated;
grant execute on function public.reservar_material(text,integer,text) to service_role;

create function public.validar_material_publico() returns trigger language plpgsql set search_path = '' as $$
declare portada public.material_publico;
begin
  select * into portada from public.material_publico m where m.id=new.portada_publica_id
    and m.propiedad_id=old.id::text and m.ficha_version=old.ficha_version and m.contenido is not null;
  if not found or split_part(portada.fuente,':',1) <> coalesce(new.portada_drive_id,'portada-alternativa') then
    raise exception using errcode='23514',message='Prepara y revisa una portada para esta versión de la ficha';
  end if;
  if cardinality(new.galeria_publica_ids)>12 or exists (
    select 1 from unnest(new.galeria_publica_ids) elegido
    where not exists(select 1 from public.material_publico m where m.id=elegido
      and m.propiedad_id=old.id::text and m.ficha_version=old.ficha_version and m.contenido is not null)
  ) then raise exception using errcode='23514',message='Revisa la selección de fotos públicas'; end if;
  return new;
end;
$$;
revoke all on function public.validar_material_publico() from public,anon,authenticated;
create trigger a_validar_material_publico before update on public.propiedades for each row
when (new.publicada_en is not null and (old.publicada_en is null
  or new.portada_publica_id is distinct from old.portada_publica_id
  or new.galeria_publica_ids is distinct from old.galeria_publica_ids))
execute function public.validar_material_publico();
create trigger versionar_material before update on public.propiedades for each row
when (new.portada_publica_id is distinct from old.portada_publica_id or new.galeria_publica_ids is distinct from old.galeria_publica_ids)
execute function public.versionar_ficha();

create function public.limpiar_material() returns trigger language plpgsql set search_path = '' as $$
begin
  delete from public.material_publico where propiedad_id=old.id::text;
  return old;
end;
$$;
revoke all on function public.limpiar_material() from public,anon,authenticated;
create trigger limpiar_material after delete on public.propiedades for each row execute function public.limpiar_material();

-- Las referencias al origen quedan privadas, incluso consultando la tabla directamente.
revoke select (drive_url,imagen_portada,tiene_portada_drive) on public.propiedades from public,anon,authenticated;
alter table public.propiedades add column tiene_material_publico boolean generated always as
  (portada_publica_id is not null or portada_webp is not null) stored;
grant select (tiene_material_publico) on public.propiedades to anon,authenticated;
create or replace view public.propiedades_publicas with (security_invoker=true,security_barrier=true) as
select id,ciudad_zona,precio,arv,beds,baths,sqft,lot_size,year_built,
  null::text as drive_url,null::text as imagen_portada,estado,created_at,
  tiene_material_publico as tiene_portada_drive,ultima_confirmacion,ciudad,zip
from public.propiedades where publicada_en is not null;
create index propiedades_catalogo on public.propiedades(ciudad,zip,created_at desc,id)
where publicada_en is not null and estado='disponible';
notify pgrst,'reload schema';
commit;
