begin;

-- Reutiliza la revisión de textos del Ticket 05. El cambio de precio y
-- la invalidación ocurren en la misma escritura, sin tocar los borradores.
drop trigger revisar_textos_de_borrador on public.propiedades;
alter function public.revisar_textos_de_borrador() rename to revisar_textos_de_propiedad;

create trigger revisar_textos_de_propiedad
before update on public.propiedades
for each row
when (
  old.precio is distinct from new.precio
  or (
    old.publicada_en is null and
    (old.ciudad_zona, old.arv, old.beds, old.baths, old.sqft, old.lot_size, old.year_built)
    is distinct from
    (new.ciudad_zona, new.arv, new.beds, new.baths, new.sqft, new.lot_size, new.year_built)
  )
)
execute function public.revisar_textos_de_propiedad();

commit;
