-- =============================================================================
-- 0023 · Cómo nace el primer administrador
-- =============================================================================
-- El panel no tiene pantalla de «crear el primer admin», y hace bien: si la
-- tuviera, cualquiera que llegara antes que la dueña se quedaría con la tienda.
-- Pero eso deja un hueco real —una base recién creada no tiene a nadie que pueda
-- entrar— que hasta ahora se tapaba ejecutando SQL a mano contra producción.
--
-- Esto lo convierte en algo declarado: una lista corta de correos que, **la
-- primera vez que se registren**, nacen con el rol indicado en vez de como
-- cliente.
--
-- POR QUÉ ES SEGURO
--
--   * La tabla no tiene ni un privilegio concedido. No la alcanza `anon`, ni
--     `authenticated`, ni `service_role`: solo el disparador de alta, que es
--     `security definer` y corre como el dueño del esquema. Por la API REST no
--     existe.
--   * Cada fila sirve **una vez**. Al usarse queda marcada y deja de valer.
--   * Cada fila **caduca**. Una invitación que sigue viva seis meses después es
--     una puerta abierta que nadie recuerda haber dejado.
--
-- LO QUE NO RESUELVE, Y CONVIENE SABERLO
--
-- Mientras una fila esté viva y sin usar, quien registre ese correo obtiene ese
-- rol. Si el proyecto no exige confirmar el correo, basta con conocer la
-- dirección. Por eso las filas caducan en una semana y por eso lo sensato es
-- registrarse enseguida: en cuanto la cuenta existe, la fila se apaga sola.
-- =============================================================================

create table if not exists public.admin_bootstrap (
  email      extensions.citext primary key,
  role       public.user_role not null,
  note       text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  used_at    timestamptz,
  used_by    uuid references auth.users (id) on delete set null,
  constraint admin_bootstrap_rol_util
    check (role in ('operator', 'admin', 'superadmin'))
);

comment on table public.admin_bootstrap is
  'Correos que nacen con rol de equipo al registrarse. Sin privilegios concedidos a propósito: solo la lee el disparador de alta.';

-- Explícito, y no por descuido. La migración 0022 declaró `default privileges`
-- para que ninguna tabla nueva vuelva a nacer sin permisos; esta es justo la
-- excepción, y por eso se revocan a mano y a la vista.
revoke all on public.admin_bootstrap from anon, authenticated, service_role;

-- RLS activada sin ninguna política: la barrera real es la ausencia de
-- privilegios, pero dejar la tabla sin RLS sería una señal confusa para quien
-- audite el esquema y para el propio revisor de Supabase.
alter table public.admin_bootstrap enable row level security;

-- --- El alta de usuario consulta la lista ------------------------------------
-- El rol se decide en el INSERT del perfil, no con un UPDATE posterior. No es
-- casual: `guard_profile_privileges` vigila los UPDATE de `profiles` para
-- impedir la escalada de privilegios, y hacerlo en dos pasos obligaría a
-- esquivar esa guarda. Poner el rol correcto desde el principio no la esquiva:
-- no la necesita.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rol_inicial public.user_role := 'customer';
begin
  select b.role into rol_inicial
  from public.admin_bootstrap b
  where b.email = new.email
    and b.used_at is null
    and b.expires_at > now();

  if rol_inicial is null then
    rol_inicial := 'customer';
  else
    update public.admin_bootstrap
    set used_at = now(), used_by = new.id
    where email = new.email;
  end if;

  insert into public.profiles (id, email, full_name, phone, role)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    rol_inicial
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

comment on function public.handle_new_user() is
  'Crea el perfil de cada usuario nuevo. El rol sale de admin_bootstrap si el correo está invitado; si no, cliente.';

-- La 0020 revocó `execute` de todas las funciones de disparador. Esta se acaba
-- de reescribir, así que vuelve a nacer con el `execute` que Postgres concede a
-- `public` por omisión: hay que quitarlo otra vez.
revoke all on function public.handle_new_user() from public, anon, authenticated;
