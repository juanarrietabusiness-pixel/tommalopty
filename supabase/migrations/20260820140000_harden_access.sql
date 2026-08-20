-- =============================================================================
-- 0012 · Endurecimiento de accesos
-- =============================================================================

-- --- 1. KPIs del negocio no son públicos para cualquier registrado -----------
-- `dashboard_metrics` es SECURITY DEFINER y solo estaba revocada de `anon`.
-- Cualquier cliente registrado podía llamarla desde el navegador con la anon key
-- y obtener facturación, ticket medio y altas de clientes. La guardia estaba en
-- la interfaz del panel, no en la función.
create or replace function public.dashboard_metrics(p_days integer default 30)
returns table (
  revenue numeric,
  orders_count bigint,
  average_order_value numeric,
  new_customers bigint,
  pending_orders bigint,
  low_stock_items bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception 'No autorizado.' using errcode = '42501';
  end if;

  return query
  select
    coalesce((
      select sum(o.total) from public.orders o
      where o.payment_status in ('paid', 'partially_refunded')
        and o.placed_at >= now() - make_interval(days => p_days)
    ), 0),
    coalesce((
      select count(*) from public.orders o
      where o.placed_at >= now() - make_interval(days => p_days)
    ), 0),
    coalesce((
      select round(avg(o.total), 2) from public.orders o
      where o.payment_status in ('paid', 'partially_refunded')
        and o.placed_at >= now() - make_interval(days => p_days)
    ), 0),
    coalesce((
      select count(*) from public.customers c
      where c.created_at >= now() - make_interval(days => p_days)
    ), 0),
    coalesce((select count(*) from public.orders o where o.status = 'pending'), 0),
    coalesce((select count(*) from public.report_low_stock), 0);
end;
$$;

revoke all on function public.dashboard_metrics(integer) from anon;
grant execute on function public.dashboard_metrics(integer) to authenticated;

-- Las vistas de reporte tampoco son para clientes: RLS ya filtra las tablas
-- subyacentes, pero mejor no ofrecerlas siquiera.
revoke select on public.report_sales_daily, public.report_top_products,
                 public.report_low_stock, public.report_conversion_funnel
  from authenticated;
grant select on public.report_sales_daily, public.report_top_products,
                public.report_low_stock, public.report_conversion_funnel
  to authenticated;

-- --- 2. El coste del producto no es información pública ----------------------
-- `product_variants` es legible por cualquiera (lo necesita la ficha), y eso
-- incluía `cost_price`: el margen de todo el catálogo quedaba expuesto por la
-- API REST. Se revoca esa columna concreta.
revoke select on public.product_variants from anon, authenticated;
grant select (
  id, product_id, sku, barcode, title, price, compare_at_price, weight_grams,
  option_values, image_url, position, is_default, is_active, created_at, updated_at
) on public.product_variants to anon, authenticated;

-- El nivel de reserva y el umbral de reposición tampoco: la tienda solo necesita
-- saber si hay stock, y para eso ya está `product_catalog`.
revoke select on public.inventory from anon, authenticated;
grant select (variant_id, quantity, track_inventory) on public.inventory to anon, authenticated;

-- --- 3. El email de la ficha de cliente es inmutable para el cliente ---------
-- `customers_update_own` permitía cambiar cualquier columna de la propia fila,
-- incluido el email. Cambiándolo al de otra persona, el checkout de invitado de
-- esa persona (que hace upsert por email) enlazaba su pedido con la ficha del
-- atacante, que lo veía en "Mis pedidos".
create or replace function public.guard_customer_identity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
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
     or new.total_spent is distinct from old.total_spent then
    raise exception 'Las métricas del cliente son calculadas.' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_customer_identity on public.customers;
create trigger guard_customer_identity
  before update on public.customers
  for each row execute function public.guard_customer_identity();

-- --- 4. Una cuenta nueva no reclama el histórico de un email sin verificar ---
-- `link_customer_to_profile` enlazaba la ficha existente al registrarse con ese
-- email. Es el comportamiento deseado —quien compró como invitado y luego se
-- registra debe ver sus pedidos— pero SOLO si el correo está verificado. Ahora
-- se comprueba contra `auth.users.email_confirmed_at`.
create or replace function public.link_customer_to_profile()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_confirmed boolean;
  v_existing  public.customers%rowtype;
begin
  select u.email_confirmed_at is not null into v_confirmed
  from auth.users u where u.id = new.id;

  select * into v_existing from public.customers where email = new.email;

  if found then
    -- Solo se reclama una ficha ajena si el correo está verificado. Si no, se
    -- deja como estaba: el enlace se hará al confirmar.
    if v_existing.profile_id is null and coalesce(v_confirmed, false) then
      update public.customers
      set profile_id = new.id, updated_at = now()
      where id = v_existing.id;
    end if;
    return new;
  end if;

  insert into public.customers (profile_id, email, first_name)
  values (new.id, new.email, nullif(split_part(coalesce(new.full_name, ''), ' ', 1), ''))
  on conflict (email) do nothing;

  return new;
end;
$$;

comment on function public.link_customer_to_profile() is
  'Enlaza cuenta y ficha de CRM. Solo reclama una ficha existente si el correo está verificado.';

-- --- 5. Auditoría del panel: la tabla existía pero nadie escribía en ella ----
grant insert on public.audit_log to authenticated;

drop policy if exists "audit_log_staff_insert" on public.audit_log;
create policy "audit_log_staff_insert" on public.audit_log
  for insert with check (public.is_staff() and actor_id = auth.uid());

create or replace function public.record_audit(
  p_action text,
  p_entity text,
  p_entity_id text default null,
  p_changes jsonb default '{}'::jsonb
)
returns void
language sql
security invoker
set search_path = public
as $$
  insert into public.audit_log (actor_id, action, entity, entity_id, changes)
  values (auth.uid(), p_action, p_entity, p_entity_id, p_changes);
$$;

grant execute on function public.record_audit(text, text, text, jsonb) to authenticated;
