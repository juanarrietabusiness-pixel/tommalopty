-- =============================================================================
-- Límite de tasa para las altas de newsletter (#9)
-- =============================================================================
-- POR QUÉ EN LA BASE Y NO EN LA RUTA
--
-- La tienda corre en Cloudflare Workers: cada petición puede caer en un aislado
-- distinto y no hay memoria compartida entre ellos. Un contador en memoria
-- contaría desde cero cada pocas peticiones, que es lo mismo que no contar.
-- La base es el único sitio con estado compartido que ya está enchufado.
--
-- QUÉ SE GUARDA, Y QUÉ NO
--
-- El hash de la IP, nunca la IP. Es un dato personal y aquí solo hace falta para
-- responder «¿es la misma de antes?», que un hash contesta igual de bien. El
-- hash lleva sal —el propio identificador del proyecto no serviría: un atacante
-- que sospeche una IP podría comprobarla—, y la sal vive en la base, no en el
-- código del navegador.
-- =============================================================================

create table if not exists public.lead_intentos (
  ip_hash    text        not null,
  creado_en  timestamptz not null default now()
);

comment on table public.lead_intentos is
  'Marcas de tiempo por IP (hasheada) para limitar altas de newsletter. No '
  'contiene direcciones IP ni correos: solo sirve para contar. Ver issue #9.';

create index if not exists lead_intentos_ip_idx
  on public.lead_intentos (ip_hash, creado_en desc);

-- Nadie de fuera necesita ver esto, y RLS sin políticas deniega por defecto.
alter table public.lead_intentos enable row level security;
revoke all on public.lead_intentos from anon, authenticated;

-- La sal del hash. Se genera aquí y no sale nunca de la base.
create table if not exists public.lead_sal (
  id  boolean primary key default true check (id),
  sal text    not null
);
alter table public.lead_sal enable row level security;
revoke all on public.lead_sal from anon, authenticated;

insert into public.lead_sal (id, sal)
values (true, encode(extensions.gen_random_bytes(32), 'hex'))
on conflict (id) do nothing;

/**
 * Registra un alta, o la rechaza por exceso.
 *
 * Devuelve `true` si se guardó y `false` si la IP se pasó del límite. No lanza
 * excepción a propósito: quien llama tiene que poder responder 429 sin que un
 * intento de spam ensucie los registros de error de la tienda.
 *
 * El límite es por IP y por hora. Diez es holgado para una persona —que se dará
 * de alta una vez— y estrecho para un bot.
 */
create or replace function public.registrar_lead(
  p_email   text,
  p_source  text,
  p_utm     jsonb,
  p_ip      text,
  p_limite  integer default 10
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_recientes integer;
  v_ip_hash   text;
begin
  -- La IP llega en claro y se hashea aquí: así la ruta nunca ve la sal, y la IP
  -- no se guarda en ninguna parte. Sin IP identificable se cuenta todo bajo una
  -- clave común —peor de repartir, pero impide que quitar la cabecera desactive
  -- el límite—.
  v_ip_hash := public.hash_de_ip(p_ip);

  select count(*) into v_recientes
  from public.lead_intentos
  where ip_hash = v_ip_hash
    and creado_en > now() - interval '1 hour';

  if v_recientes >= p_limite then
    return false;
  end if;

  insert into public.lead_intentos (ip_hash) values (v_ip_hash);

  insert into public.leads (email, source, utm)
  values (p_email, p_source, coalesce(p_utm, '{}'::jsonb))
  on conflict (email, source) do update
    set utm = coalesce(excluded.utm, public.leads.utm);

  return true;
end;
$$;

-- Solo el servidor. La ruta es la única puerta, y esto lo fija.
revoke all on function public.registrar_lead(text, text, jsonb, text, integer) from public;
revoke all on function public.registrar_lead(text, text, jsonb, text, integer) from anon, authenticated;
grant execute on function public.registrar_lead(text, text, jsonb, text, integer) to service_role;

/**
 * El hash de una IP, con la sal que vive en la base.
 *
 * Separada solo por legibilidad: la llama `registrar_lead` y **no se concede a
 * nadie**. Nadie de fuera necesita convertir una IP en su hash, y poder hacerlo
 * sería justo lo que permite comprobar si una IP concreta pasó por aquí.
 */
create or replace function public.hash_de_ip(p_ip text)
returns text
language sql
security definer
set search_path = public, extensions
as $$
  select encode(
    extensions.digest(coalesce(nullif(trim(p_ip), ''), 'sin-ip') || (select sal from public.lead_sal), 'sha256'),
    'hex'
  );
$$;

revoke all on function public.hash_de_ip(text) from public;
revoke all on function public.hash_de_ip(text) from anon, authenticated;

/**
 * Barrido de los intentos viejos.
 *
 * Sin esto la tabla crece para siempre guardando algo que solo sirve una hora.
 * Se agenda con pg_cron, igual que la caducidad de reservas.
 */
create or replace function public.limpiar_lead_intentos()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.lead_intentos where creado_en < now() - interval '2 hours';
$$;
