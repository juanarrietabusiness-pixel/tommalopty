-- El disparador que activa RLS en toda tabla nueva, por fin en el repositorio
-- (issue #68)
--
-- QUÉ PASÓ
--
-- El issue #11 —«nada garantiza que una tabla nueva nazca con RLS activo»— se
-- cerró comprobando contra staging que sí lo garantiza: existe un disparador de
-- eventos DDL, `ensure_rls`, que activa RLS sobre cualquier tabla nueva de
-- `public` en el momento de crearla. La comprobación fue real: se creó una
-- tabla dentro de un `begin … rollback` y salió con `relrowsecurity = true`.
--
-- Lo que no se comprobó es si el disparador estaba **en el control de
-- versiones**. No lo estaba. En todo el repositorio aparecía exactamente dos
-- veces, y las dos eran comentarios dentro de `20260830040000`, explicando por
-- qué la revocación masiva de `EXECUTE` tenía que dejarlo fuera.
--
-- Así que la garantía existía en staging —donde nadie va a crear tablas
-- nuevas— y no existía en un proyecto de Supabase nuevo, en un `db reset`
-- local, ni en el Postgres contra el que CI corre los tests de RLS. Es decir:
-- en los tres sitios donde sí se crean tablas.
--
-- La lección, que vale más que el arreglo: **preguntarle a la base de datos y
-- preguntarle al código son dos comprobaciones distintas, y hacen falta las
-- dos.** Una dice qué hay; la otra, qué se reproduce.
--
-- LA DEFINICIÓN ES LA QUE ESTABA CORRIENDO, COPIADA
--
-- No es una reescritura. Se leyó de `pg_get_functiondef` en staging y se pegó
-- tal cual, porque la que lleva meses funcionando manda sobre cualquier
-- versión que uno recuerde. Cinco cosas que tiene y que una reescritura de
-- memoria se deja:
--
--   1. Filtra por TRES etiquetas, no una: `CREATE TABLE`, `CREATE TABLE AS` y
--      `SELECT INTO`. Las tres crean una tabla.
--   2. Filtra además por `object_type in ('table','partitioned table')`.
--   3. Cada `alter table` va en su propio `begin … exception`, así que una
--      tabla que falle no aborta el DDL de quien la estaba creando.
--   4. `alter table IF EXISTS`.
--   5. `search_path` es solo `pg_catalog`.
--
-- LA TRAMPA DEL ORDEN, QUE ES LA QUE OBLIGA AL `REVOKE` DE ABAJO
--
-- La migración 0021 revoca `EXECUTE` en masa a las funciones de disparador
-- consultando el catálogo, y su barrido incluye `event_trigger` justo por esta
-- función. Pero esa migración corre ANTES que esta.
--
-- En staging da igual: la función ya existe, y `create or replace` conserva los
-- privilegios que tenga. En una base nueva no: aquí se crea de cero, después
-- del barrido, y **una función nueva nace con `EXECUTE` para `PUBLIC`**. Sin el
-- `revoke` de abajo, el arreglo de #68 abriría en toda base nueva justo lo que
-- #67 vino a cerrar.
--
-- (Revocar `EXECUTE` no rompe el disparador: Postgres comprueba ese permiso al
-- CREAR el disparador, no cada vez que se dispara. Está explicado en la 0021.)
--
-- LO QUE ESTO NO HACE
--
-- Activa RLS; no escribe políticas. Una tabla nueva sale con RLS y cero
-- políticas: el estado seguro —nadie ve nada— y no el estado útil. La política
-- sigue siendo trabajo de la migración. Lo que ya no puede pasar es que una
-- tabla nazca abierta de par en par.
--
-- Y no protege hacia atrás: las tablas de las migraciones anteriores a esta se
-- crearon sin él. No hace falta que lo haga — todas activan RLS explícitamente,
-- y hoy no hay ni una tabla de `public` sin RLS.

create or replace function public.rls_auto_enable()
returns event_trigger
language plpgsql
security definer
set search_path to 'pg_catalog'
as $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$;

comment on function public.rls_auto_enable() is
  'Disparador de eventos DDL: activa RLS sobre toda tabla nueva de public. Activa RLS, NO escribe políticas. Issue #68.';

-- Ver «la trampa del orden», arriba. No sobra aunque en staging sea un no-op.
revoke all on function public.rls_auto_enable() from public;
revoke all on function public.rls_auto_enable() from anon, authenticated;

-- Idempotente: en staging el disparador ya existe desde hace meses.
drop event trigger if exists ensure_rls;
create event trigger ensure_rls
  on ddl_command_end
  when tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
  execute function public.rls_auto_enable();
