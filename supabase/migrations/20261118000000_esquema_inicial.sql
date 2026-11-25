begin;
-- Base reproducible. En una instalación existente conserva las tablas previas.
create table if not exists public.propiedades (
  id uuid primary key default gen_random_uuid(),
  direccion_privada text not null, ciudad_zona text not null, precio numeric not null,
  arv numeric, beds integer, baths numeric, sqft numeric, lot_size text, year_built integer,
  drive_url text, imagen_portada text,
  estado text not null default 'disponible' check (estado in ('disponible','en_contrato','vendida')),
  created_at timestamptz not null default now(),
  script_fb_es text, script_fb_en text, script_wa_vip text, script_filtro_curiosos text
);
create table if not exists public.leads_compradores (
  id uuid primary key default gen_random_uuid(),
  nombre text not null, whatsapp text not null, perfil text not null,
  tiene_itin boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.propiedades enable row level security;
alter table public.leads_compradores enable row level security;
revoke all on public.propiedades, public.leads_compradores from public, anon, authenticated;
commit;
