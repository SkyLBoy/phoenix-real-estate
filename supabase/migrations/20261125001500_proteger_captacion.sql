begin;
create table public.envios_publicos (
  canal text not null check (canal in ('vip','casa')),
  clave text not null, contacto text not null,
  creado_en timestamptz not null default now(),
  primary key (canal, clave)
);
create index envios_publicos_fecha on public.envios_publicos (creado_en);
create index envios_publicos_contacto on public.envios_publicos (contacto, creado_en);
alter table public.envios_publicos enable row level security;
revoke all on public.envios_publicos from public, anon, authenticated;

-- Una transacción cubre cuota, idempotencia y la inserción real.
-- Las huellas son HMAC calculados por el servidor y no contienen el teléfono.
create function public.registrar_envio_publico(canal text, clave text, contacto text, datos jsonb)
returns text language plpgsql security definer set search_path = '' as $$
declare anterior timestamptz;
begin
  if canal not in ('vip','casa') or clave !~ '^[a-f0-9]{64}$' or contacto !~ '^[a-f0-9]{64}$'
    or jsonb_typeof(datos) <> 'object' then raise exception 'Envío inválido'; end if;
  perform pg_advisory_xact_lock(732619402);
  delete from public.envios_publicos where creado_en < now() - interval '24 hours';
  select e.creado_en into anterior from public.envios_publicos e
    where e.canal = registrar_envio_publico.canal and e.clave = registrar_envio_publico.clave;
  if anterior is not null then return 'repetido'; end if;
  if (select count(*) from public.envios_publicos e where e.contacto = registrar_envio_publico.contacto
      and e.creado_en > now() - interval '1 hour') >= 5
    or (select count(*) from public.envios_publicos where creado_en > now() - interval '1 hour') >= 300
    then return 'limitado'; end if;
  if canal = 'vip' then
    update public.leads_compradores set nombre = datos->>'nombre', perfil = datos->>'perfil',
      tiene_itin = (datos->>'tiene_itin')::boolean where whatsapp = datos->>'whatsapp';
    if not found then
      insert into public.leads_compradores(nombre,whatsapp,perfil,tiene_itin)
      values(datos->>'nombre',datos->>'whatsapp',datos->>'perfil',(datos->>'tiene_itin')::boolean);
    end if;
  else
    insert into public.casas_ofrecidas(nombre,whatsapp,zona,condicion,precio_esperado,plazo,fotos_url,notas)
    values(datos->>'nombre',datos->>'whatsapp',datos->>'zona',datos->>'condicion',
      (datos->>'precio_esperado')::numeric,datos->>'plazo',datos->>'fotos_url',datos->>'notas');
  end if;
  insert into public.envios_publicos(canal,clave,contacto) values(canal,clave,contacto);
  return 'registrado';
end;
$$;
revoke all on function public.registrar_envio_publico(text,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.registrar_envio_publico(text,text,text,jsonb) to service_role;
notify pgrst, 'reload schema';
commit;
