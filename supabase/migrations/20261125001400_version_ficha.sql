begin;
alter table public.propiedades add column ficha_version integer not null default 0 check (ficha_version >= 0);
create function public.versionar_ficha() returns trigger language plpgsql set search_path = '' as $$
begin
  new.ficha_version := old.ficha_version + 1;
  return new;
end;
$$;
revoke execute on function public.versionar_ficha() from public, anon, authenticated;
create trigger versionar_ficha before update on public.propiedades for each row
when ((old.direccion_privada,old.ciudad_zona,old.precio,old.arv,old.beds,old.baths,old.sqft,old.lot_size,old.year_built,old.drive_url,old.imagen_portada,old.fotos_drive,old.portada_drive_id,old.notas_extra,old.publicada_en,old.estado,old.ultima_confirmacion)
is distinct from
(new.direccion_privada,new.ciudad_zona,new.precio,new.arv,new.beds,new.baths,new.sqft,new.lot_size,new.year_built,new.drive_url,new.imagen_portada,new.fotos_drive,new.portada_drive_id,new.notas_extra,new.publicada_en,new.estado,new.ultima_confirmacion))
execute function public.versionar_ficha();
revoke all privileges (ficha_version) on public.propiedades from public, anon, authenticated;
notify pgrst, 'reload schema';
commit;
