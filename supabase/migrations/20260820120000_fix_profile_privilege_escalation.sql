-- =============================================================================
-- 0010 · Corrección de escalada de privilegios en `profiles`
-- =============================================================================
-- PROBLEMA DETECTADO POR LOS TESTS DE RLS
--
-- La política `profiles_update_own` permite a cada persona editar su propia
-- fila:
--
--   for update using (id = auth.uid()) with check (id = auth.uid())
--
-- RLS en Postgres es a nivel de FILA, no de COLUMNA: la política autoriza el
-- UPDATE de la fila entera, incluida la columna `role`. Es decir, cualquier
-- cliente registrado podía ejecutar
--
--   update profiles set role = 'superadmin' where id = auth.uid();
--
-- y quedarse con control total de la tienda: catálogo, pedidos, datos de todos
-- los clientes e integraciones. Severidad: crítica.
--
-- SOLUCIÓN
--
-- Un trigger BEFORE UPDATE que rechaza cualquier cambio en las columnas
-- sensibles salvo que quien lo intenta sea superadministrador. Se implementa con
-- trigger y no con GRANT por columna porque el superadmin también entra como
-- `authenticated` y un GRANT lo bloquearía a él también.
-- =============================================================================

create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Las operaciones internas (service_role, triggers del sistema, migraciones)
  -- no tienen sesión de usuario y no deben verse afectadas.
  if auth.uid() is null then
    return new;
  end if;

  if public.is_superadmin() then
    return new;
  end if;

  if new.role is distinct from old.role then
    raise exception 'Solo un superadministrador puede cambiar el rol de una cuenta.'
      using errcode = '42501';
  end if;

  -- Una cuenta desactivada no puede reactivarse a sí misma.
  if new.is_active is distinct from old.is_active then
    raise exception 'Solo un superadministrador puede activar o desactivar cuentas.'
      using errcode = '42501';
  end if;

  -- El email lo gobierna Supabase Auth; cambiarlo aquí desincronizaría la
  -- cuenta de su ficha de CRM.
  if new.email is distinct from old.email then
    raise exception 'El correo se cambia desde la cuenta, no desde el perfil.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

comment on function public.guard_profile_privileges() is
  'Impide la escalada de privilegios: role, is_active y email solo los cambia un superadmin.';

drop trigger if exists guard_profile_privileges on public.profiles;
create trigger guard_profile_privileges
  before update on public.profiles
  for each row execute function public.guard_profile_privileges();
