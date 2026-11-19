begin;

alter table public.propiedades
  add column condiciones_texto jsonb not null default '{}'::jsonb
    check (jsonb_typeof(condiciones_texto) = 'object'),
  add column textos_version integer not null default 0,
  add column script_fb_es_aprobado boolean not null default false,
  add column script_fb_en_aprobado boolean not null default false,
  add column script_wa_vip_aprobado boolean not null default false,
  add column script_filtro_curiosos_aprobado boolean not null default false,
  add constraint propiedades_textos_aprobados_no_vacios check (
    (not script_fb_es_aprobado or nullif(btrim(script_fb_es), '') is not null)
    and (not script_fb_en_aprobado or nullif(btrim(script_fb_en), '') is not null)
    and (not script_wa_vip_aprobado or nullif(btrim(script_wa_vip), '') is not null)
    and (not script_filtro_curiosos_aprobado or nullif(btrim(script_filtro_curiosos), '') is not null)
  );

-- Cambiar datos comerciales del borrador devuelve sus textos a revisión.
create function public.revisar_textos_de_borrador()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.textos_version := old.textos_version + 1;
  new.script_fb_es_aprobado := false;
  new.script_fb_en_aprobado := false;
  new.script_wa_vip_aprobado := false;
  new.script_filtro_curiosos_aprobado := false;
  return new;
end;
$$;

revoke execute on function public.revisar_textos_de_borrador() from public, anon, authenticated;

create trigger revisar_textos_de_borrador
before update on public.propiedades
for each row
when (
  old.publicada_en is null and
  (old.ciudad_zona, old.precio, old.arv, old.beds, old.baths, old.sqft, old.lot_size, old.year_built)
  is distinct from
  (new.ciudad_zona, new.precio, new.arv, new.beds, new.baths, new.sqft, new.lot_size, new.year_built)
)
execute function public.revisar_textos_de_borrador();

notify pgrst, 'reload schema';
commit;
