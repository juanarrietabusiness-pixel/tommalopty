-- =============================================================================
-- 0002 · Identidad, perfiles y helpers de autorización
-- =============================================================================
-- `auth.users` es propiedad de Supabase Auth. Reflejamos cada usuario en
-- `public.profiles` para poder asignarle un rol y consultarlo desde RLS.
-- =============================================================================

create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  email        extensions.citext not null,
  full_name    text,
  phone        text,
  avatar_url   text,
  role         public.user_role not null default 'customer',
  is_active    boolean not null default true,
  last_seen_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.profiles is
  'Perfil de aplicación por usuario de auth.users. El campo `role` gobierna RLS.';

create unique index if not exists profiles_email_key on public.profiles (email);
create index if not exists profiles_role_idx on public.profiles (role) where role <> 'customer';

drop trigger if exists set_updated_at on public.profiles;
create trigger set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- --- Helpers de autorización -------------------------------------------------
-- SECURITY DEFINER: las políticas RLS de `profiles` no se evalúan dentro de estas
-- funciones, lo que evita recursión infinita al comprobar el rol del usuario.

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.role from public.profiles p where p.id = auth.uid() and p.is_active),
    'customer'::public.user_role
  );
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() in ('operator', 'admin', 'superadmin');
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() in ('admin', 'superadmin');
$$;

create or replace function public.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() = 'superadmin';
$$;

comment on function public.is_staff() is
  'true para operator/admin/superadmin. Usar en políticas de lectura del panel.';
comment on function public.is_admin() is
  'true para admin/superadmin. Usar en políticas de escritura del panel.';
comment on function public.is_superadmin() is
  'true solo para superadmin: gestión de usuarios admin e integraciones.';

-- --- Alta automática de perfil ----------------------------------------------
-- Cada usuario nuevo de Supabase Auth obtiene perfil (rol `customer`) y su ficha
-- de CRM. La ficha de cliente se enlaza en la migración de CRM mediante otro
-- trigger, para no acoplar este archivo a tablas que aún no existen.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, phone)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'phone', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
