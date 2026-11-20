begin;

-- La portada y la publicación se guardan en la misma escritura de la ficha.
-- Las filas antiguas se completan al abrir su portada por primera vez.
alter table public.propiedades
  add column portada_webp bytea,
  add constraint portada_webp_valida check (
    portada_webp is null or (
      publicada_en is not null and portada_drive_id is not null
      and octet_length(portada_webp) between 1 and 2097152
    )
  );

revoke all privileges (portada_webp) on public.propiedades from public, anon, authenticated;

notify pgrst, 'reload schema';
commit;
