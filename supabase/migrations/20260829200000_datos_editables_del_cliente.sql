-- =============================================================================
-- 0019 · Qué puede editar un cliente de su propia ficha
-- =============================================================================
-- CONTEXTO
--
-- El panel de cliente gana una pantalla para editar nombre y teléfono, así que
-- `customers` pasa a estar expuesta a un formulario público por primera vez.
-- Antes de abrirla conviene terminar el trabajo que empezó la migración 0013.
--
-- PROBLEMA
--
-- `customers_update_own` autoriza el UPDATE de la fila entera:
--
--   for update using (profile_id = auth.uid()) with check (profile_id = auth.uid())
--
-- Es el mismo caso que la escalada de privilegios de `profiles` (migración
-- 0010): RLS es por fila, no por columna. La migración 0013 tapó el email, el
-- `profile_id` y las métricas de compra, pero dejó fuera tres columnas que
-- tampoco son del cliente:
--
--   * `tags`         — un cliente podía etiquetarse «mayorista» o «VIP» y
--                      colarse en la segmentación del CRM. Hoy las etiquetas no
--                      dan descuentos, pero sí guían a quien atiende, y las
--                      campañas (tablas ya creadas) segmentarán por aquí.
--   * `notes_count`  — desajusta el contador de notas internas del CRM.
--   * `last_order_at`— lo mantienen los triggers de pedido; a mano falsea los
--                      informes de recencia.
--
-- Severidad: media. No da control de la tienda, pero corrompe los datos con los
-- que se toman decisiones comerciales, y lo hace de forma silenciosa.
--
-- SOLUCIÓN
--
-- Ampliar el trigger que ya existe, en vez de añadir otro: un solo sitio donde
-- mirar qué puede tocar un cliente de su ficha.
--
-- Se aprovecha para que `marketing_opt_in_at` deje de ser un campo libre. Es el
-- rastro de cuándo se dio el consentimiento de marketing: si lo escribe quien
-- quiera, no sirve como prueba de nada. Pasa a calcularlo el trigger a partir
-- del propio `accepts_marketing`, que sí es del cliente.
-- =============================================================================

create or replace function public.guard_customer_identity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- El consentimiento de marketing se sella solo, para todo el mundo: es un
  -- rastro de auditoría, no un dato que se teclea. Va antes de la salida
  -- temprana para que valga también cuando quien edita es el panel.
  if new.accepts_marketing and not old.accepts_marketing then
    new.marketing_opt_in_at := now();
  elsif not new.accepts_marketing and old.accepts_marketing then
    new.marketing_opt_in_at := null;
  else
    new.marketing_opt_in_at := old.marketing_opt_in_at;
  end if;

  -- Las operaciones internas (service_role, triggers, migraciones) no tienen
  -- sesión, y el panel administrativo sí puede editar la ficha entera.
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  if new.email is distinct from old.email then
    raise exception 'El correo de la cuenta se cambia desde el perfil, no desde aquí.'
      using errcode = '42501';
  end if;

  -- Reasignar la ficha a otro perfil es tomar el control de su histórico.
  if new.profile_id is distinct from old.profile_id then
    raise exception 'No se puede reasignar una ficha de cliente.' using errcode = '42501';
  end if;

  -- Las métricas las mantienen los triggers; nadie las edita a mano.
  if new.orders_count is distinct from old.orders_count
     or new.total_spent is distinct from old.total_spent
     or new.last_order_at is distinct from old.last_order_at then
    raise exception 'Las métricas del cliente son calculadas.' using errcode = '42501';
  end if;

  -- Las etiquetas son la herramienta de segmentación del CRM: las pone quien
  -- atiende, no quien compra.
  if new.tags is distinct from old.tags then
    raise exception 'Las etiquetas de cliente solo las cambia el equipo.'
      using errcode = '42501';
  end if;

  if new.notes_count is distinct from old.notes_count then
    raise exception 'El contador de notas es calculado.' using errcode = '42501';
  end if;

  return new;
end;
$$;

comment on function public.guard_customer_identity() is
  'Un cliente solo cambia de su ficha nombre, apellido, teléfono y consentimiento de marketing. El resto lo gobiernan el equipo o los triggers.';

-- El trigger ya existe desde la migración 0013 y apunta a esta misma función,
-- pero se recrea para que aplicar el esquema desde cero en cualquier orden deje
-- siempre el disparador puesto.
drop trigger if exists guard_customer_identity on public.customers;
create trigger guard_customer_identity
  before update on public.customers
  for each row execute function public.guard_customer_identity();
