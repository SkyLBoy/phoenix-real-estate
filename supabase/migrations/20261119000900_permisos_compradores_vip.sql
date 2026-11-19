begin;

alter table public.leads_compradores enable row level security;
alter table public.leads_compradores
  add column if not exists id uuid not null default gen_random_uuid(),
  add column if not exists created_at timestamptz;
alter table public.leads_compradores alter column created_at set default now();

-- El formulario público escribe únicamente mediante el servidor.
revoke all on public.leads_compradores from public, anon, authenticated;
do $$
declare
  columnas text;
  secuencia text := pg_get_serial_sequence('public.leads_compradores', 'id');
begin
  select string_agg(quote_ident(attname), ', ')
  into columnas
  from pg_attribute
  where attrelid = 'public.leads_compradores'::regclass
    and attnum > 0 and not attisdropped;
  execute format(
    'revoke all privileges (%s) on public.leads_compradores from public, anon, authenticated',
    columnas
  );
  if secuencia is not null then
    execute format('grant usage on sequence %s to service_role', secuencia);
  end if;
end
$$;

grant select, insert on public.leads_compradores to service_role;
notify pgrst, 'reload schema';
commit;
