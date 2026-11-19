begin;

-- NULL en publicada_en identifica un borrador. Las filas existentes quedan
-- pendientes de revisión, ya que no se registraba la aprobación de su portada.
alter table public.propiedades
  add column publicada_en timestamptz,
  add column ultima_confirmacion timestamptz,
  add column if not exists notas_extra text,
  alter column direccion_privada drop not null,
  alter column ciudad_zona drop not null,
  alter column precio drop not null;

alter table public.propiedades
  add constraint propiedades_publicacion_completa check (
    publicada_en is null or (
      nullif(btrim(ciudad_zona), '') is not null
      and precio is not null and precio > 0
      and precio::text not in ('NaN', 'Infinity', '-Infinity')
      and imagen_portada is not null
      and imagen_portada ~* '^https?://[^[:space:]]+$'
    )
  );

alter table public.propiedades enable row level security;
alter table public.leads_compradores enable row level security;

-- Los grants de columna limitan los campos incluso en consultas directas.
-- La política restrictiva también se aplica si ya existe un SELECT permisivo.
revoke all on public.propiedades from public, anon, authenticated;
do $$
declare
  columnas text;
begin
  select string_agg(quote_ident(attname), ', ')
  into columnas
  from pg_attribute
  where attrelid = 'public.propiedades'::regclass
    and attnum > 0 and not attisdropped;

  execute format(
    'revoke all privileges (%s) on public.propiedades from public, anon, authenticated',
    columnas
  );
end
$$;

grant select (
  id, ciudad_zona, precio, arv, beds, baths, sqft, lot_size, year_built,
  drive_url, imagen_portada, estado, created_at, publicada_en
) on public.propiedades to anon, authenticated;
grant select, insert, update, delete on public.propiedades to service_role;

create policy propiedades_publicadas_permitir on public.propiedades
  for select to anon, authenticated using (publicada_en is not null);
create policy propiedades_publicadas_limitar on public.propiedades
  as restrictive for select to anon, authenticated using (publicada_en is not null);

-- La vista usa los permisos del visitante y respeta RLS (Postgres 15+).
create view public.propiedades_publicas
  with (security_invoker = true, security_barrier = true)
as
select id, ciudad_zona, precio, arv, beds, baths, sqft, lot_size, year_built,
       drive_url, imagen_portada, estado, created_at
from public.propiedades
where publicada_en is not null;

revoke all on public.propiedades_publicas from public, anon, authenticated;
grant select on public.propiedades_publicas to anon, authenticated;

-- Se conserva la política existente de inserción del formulario VIP.
create policy leads_sin_lectura_publica on public.leads_compradores
  as restrictive for select to anon, authenticated using (false);

notify pgrst, 'reload schema';
commit;
