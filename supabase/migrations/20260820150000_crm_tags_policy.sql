-- =============================================================================
-- 0013 · Política de `crm_tags` coherente con el resto del CRM
-- =============================================================================
-- PROBLEMA
--
-- La política era una sola, con `using` y `with check` desalineados:
--
--   for all using (public.is_staff()) with check (public.is_admin())
--
-- En Postgres `using` gobierna qué filas ve un SELECT/UPDATE/DELETE, y
-- `with check` qué filas puede dejar escritas un INSERT/UPDATE. El resultado
-- era que un operador NO podía crear una etiqueta pero SÍ podía borrarlas
-- todas — justo al revés de lo que dice el modelo de roles, donde `operator`
-- es lectura del panel.
--
-- SOLUCIÓN
--
-- Separarla en dos, siguiendo la convención que ya usa el resto del fichero de
-- políticas (`leads`, `campaigns`, `discounts`): lectura para staff, escritura
-- para admin.
--
-- Nota sobre el borrado: RLS no lanza error al borrar una fila que la política
-- oculta, simplemente no borra nada. Por eso el test que acompaña a esta
-- migración comprueba que la etiqueta sigue ahí, y no que la consulta falle.
-- =============================================================================

drop policy if exists "crm_tags_staff" on public.crm_tags;

drop policy if exists "crm_tags_staff_read" on public.crm_tags;
create policy "crm_tags_staff_read" on public.crm_tags
  for select using (public.is_staff());

drop policy if exists "crm_tags_admin_write" on public.crm_tags;
create policy "crm_tags_admin_write" on public.crm_tags
  for all using (public.is_admin()) with check (public.is_admin());
