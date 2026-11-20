begin;

create table public.casas_ofrecidas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (char_length(btrim(nombre)) between 1 and 120),
  whatsapp text not null check (whatsapp ~ '^\+[1-9][0-9]{7,14}$'),
  zona text not null check (char_length(btrim(zona)) between 1 and 120),
  condicion text not null check (condicion in ('habitable', 'necesita_arreglos', 'por_confirmar')),
  precio_esperado numeric(14,2) check (precio_esperado > 0),
  plazo text check (char_length(plazo) <= 120),
  fotos_url text check (char_length(fotos_url) <= 2048),
  notas text check (char_length(notas) <= 1000),
  estado text not null default 'nueva' check (estado in ('nueva', 'contactada', 'en_evaluacion', 'cerrada')),
  created_at timestamptz not null default now()
);

create index casas_ofrecidas_orden on public.casas_ofrecidas (created_at desc, id desc);
alter table public.casas_ofrecidas enable row level security;
revoke all on public.casas_ofrecidas from public, anon, authenticated;
grant select, insert, update on public.casas_ofrecidas to service_role;

notify pgrst, 'reload schema';
commit;
