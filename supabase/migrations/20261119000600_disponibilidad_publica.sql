begin;

-- El catálogo distingue disponibilidad reciente y por confirmar con el
-- mismo dato que usa el panel. Los estados existentes conservan sus valores.
grant select (ultima_confirmacion) on public.propiedades to anon, authenticated;

create or replace view public.propiedades_publicas
  with (security_invoker = true, security_barrier = true)
as
select id, ciudad_zona, precio, arv, beds, baths, sqft, lot_size, year_built,
       drive_url, imagen_portada, estado, created_at, tiene_portada_drive,
       ultima_confirmacion
from public.propiedades
where publicada_en is not null;

notify pgrst, 'reload schema';
commit;
