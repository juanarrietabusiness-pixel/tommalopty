-- =============================================================================
-- El buzón de `leads` deja de estar abierto a internet (#9)
-- =============================================================================
-- PROBLEMA, Y ES MÁS GRANDE DE LO QUE DECÍA EL ISSUE
--
-- El issue proponía un límite de tasa en `/api/newsletter`. Ese límite habría
-- sido **decorativo**: `anon` tiene el privilegio INSERT sobre `public.leads`, y
-- la política `leads_public_insert` lo permite con `check (true)`. Es decir,
-- cualquiera con la clave publicable —que va en el navegador, por diseño— puede
-- escribir en la tabla **sin pasar por la ruta**, directamente contra PostgREST.
--
--   select has_table_privilege('anon', 'public.leads', 'INSERT');  -- true
--
-- Poner el límite delante de una puerta y dejar la otra abierta no es un límite.
--
-- Y de paso, `authenticated` tenía la baraja entera sobre la tabla —SELECT,
-- UPDATE, DELETE, TRUNCATE—. Las políticas lo frenan casi todo, pero TRUNCATE
-- **no pasa por RLS**: no es alcanzable desde PostgREST, así que no era
-- explotable, pero es un privilegio que nadie necesita.
--
-- SOLUCIÓN
--
-- Se cierra la puerta directa y queda una sola: la ruta, que usa `service_role`
-- y que ahora sí puede limitar de verdad. Se comprobó antes de revocar que
-- **nada en la plataforma** lee ni escribe `leads` con sesión de usuario: la
-- única referencia en todo el código es `apps/storefront/src/app/api/newsletter`,
-- con el cliente de servicio.
--
-- Rol por rol y nunca con un bucle, que es la lección de `ESTADO.md` § 4.
-- =============================================================================

revoke all on public.leads from anon;
revoke all on public.leads from authenticated;

-- La política pública se va con el privilegio. Dejarla sería documentar una
-- puerta que ya no existe, y el próximo que la lea creería que sí.
drop policy if exists "leads_public_insert" on public.leads;

comment on table public.leads is
  'Altas de newsletter y contacto. Solo se escribe desde /api/newsletter con '
  'service_role, que aplica límite de tasa por IP: `anon` no tiene privilegios '
  'aquí a propósito, para que ese límite signifique algo (ver issue #9).';
