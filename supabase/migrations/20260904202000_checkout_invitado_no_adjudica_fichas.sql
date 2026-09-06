-- =============================================================================
-- Un checkout de invitado no se cuelga de la ficha de una cuenta ajena (#10)
-- =============================================================================
-- PROBLEMA
--
-- El paso 4 de `create_order` reutiliza la ficha de cliente por correo:
--
--   insert into public.customers (email, ...) values (p_email, ...)
--   on conflict (email) do update set ...
--   returning id into v_customer_id;
--
-- La función es `security definer`, así que no pasa por RLS. Si alguien compra
-- como invitado escribiendo el correo de otra persona, el pedido queda colgado
-- de la ficha de esa persona. Cuando la dueña real entra en «Mis pedidos», ve un
-- pedido que no hizo, con la dirección de envío y el importe de un desconocido.
--
-- Y hay una segunda mitad que el issue no menciona: ese `do update` **rellena
-- los huecos** de la ficha ajena —nombre, apellido, teléfono— con lo que
-- escriba quien compra. No solo se ve un pedido que no es suyo: le cambian los
-- datos.
--
-- LA DIRECCIÓN CONTRARIA YA ESTABA CUBIERTA
--
-- `link_customer_to_profile` solo reclama una ficha existente si el correo está
-- verificado (migración `20260820140000`). Esta dirección se quedó fuera.
--
-- SOLUCIÓN, Y EL COMPROMISO QUE ELIGE
--
-- `create_order` recibe `p_profile_id`: el `auth.uid()` de quien compra, que la
-- ruta lee de la sesión en el servidor, o `null` si es un invitado. La función
-- solo está concedida a `service_role`, así que ese parámetro no lo puede
-- falsificar el navegador.
--
-- Con eso, la ficha se adjudica salvo en un caso: **el correo pertenece a una
-- cuenta registrada y quien compra no ha demostrado ser esa cuenta.** Entonces
-- el pedido se crea con el correo pero sin `customer_id`, y la ficha ajena no se
-- toca.
--
-- Lo que esto cuesta, dicho claro: si una persona registrada compra sin iniciar
-- sesión, su pedido no le aparecerá en «Mis pedidos». Sigue llegándole por
-- correo con su enlace de seguimiento, y el equipo lo ve entero en el panel. Es
-- el precio de no dejar que un tercero le meta pedidos en la cuenta, y me parece
-- el lado correcto donde equivocarse.
--
-- Lo que NO cubre: un correo que todavía no es de nadie sigue adjudicándose
-- —tiene que hacerlo, o un invitado legítimo nunca vería su primer pedido al
-- registrarse—. Si alguien usa el correo de una persona no registrada, esa
-- persona verá el pedido al registrarse y verificar. Cerrar eso pide verificar
-- el correo dentro del checkout (opción 3 del issue), que es otra conversación.
--
-- DOS TRAMPAS DE ESTA MIGRACIÓN, PARA QUIEN LA LEA DESPUÉS
--
-- 1. Añadir un parámetro NO reemplaza la función: crea una sobrecarga. La de
--    nueve argumentos —la vulnerable— seguiría ahí y seguiría siendo llamable.
--    Por eso se borra explícitamente al final.
-- 2. Una función nueva nace con EXECUTE para PUBLIC. La anterior estaba
--    concedida solo a `service_role` (comprobado: `{postgres=X, service_role=X}`),
--    y sin revocar a mano, esta versión quedaría abierta a `anon`. Es decir:
--    arreglar el agujero habría abierto otro más grande.
-- =============================================================================

create or replace function public.create_order(
  p_email text,
  p_lines jsonb,
  p_shipping_address jsonb default null,
  p_shipping_method_id uuid default null,
  p_discount_code text default null,
  p_phone text default null,
  p_customer_note text default null,
  p_first_name text default null,
  p_last_name text default null,
  p_profile_id uuid default null
)
returns table (
  order_id uuid,
  order_number text,
  confirmation_token text,
  subtotal numeric,
  discount_total numeric,
  shipping_total numeric,
  total numeric
)
language plpgsql
security definer
set search_path = public, extensions
as $function$
declare
  v_pedidas       jsonb;
  v_lineas        jsonb;
  v_sin_stock     uuid;
  v_customer_id   uuid;
  v_ficha_id      uuid;
  v_ficha_profile uuid;
  v_order_id      uuid;
  v_order_number  text;
  v_token         text;
  v_subtotal      numeric(12,2) := 0;
  v_discount      numeric(12,2) := 0;
  v_discount_id   uuid;
  v_shipping      numeric(12,2) := 0;
  v_total         numeric(12,2) := 0;
  v_method        record;
  v_shipping_snapshot jsonb := null;
begin
  if p_lines is null or jsonb_array_length(p_lines) = 0 then
    raise exception 'El carrito está vacío.' using errcode = 'P0001';
  end if;

  select jsonb_agg(jsonb_build_object('variant_id', variant_id, 'quantity', quantity))
  into v_pedidas
  from (
    select (line ->> 'variant_id')::uuid as variant_id,
           sum((line ->> 'quantity')::int) as quantity
    from jsonb_array_elements(p_lines) as line
    group by 1
  ) agrupadas;

  if exists (
    select 1 from jsonb_array_elements(v_pedidas) l where (l ->> 'quantity')::int <= 0
  ) then
    raise exception 'Las cantidades deben ser mayores que cero.' using errcode = 'P0001';
  end if;

  perform 1
  from public.inventory i
  where i.variant_id in (
    select (l ->> 'variant_id')::uuid from jsonb_array_elements(v_pedidas) l
  )
  order by i.variant_id
  for update;

  select jsonb_agg(jsonb_build_object(
    'variant_id',    v.id,
    'quantity',      r.quantity,
    'unit_price',    v.price,
    'product_id',    v.product_id,
    'product_title', p.title,
    'variant_title', v.title,
    'sku',           v.sku,
    'tracked',       coalesce(inv.track_inventory, false),
    'available',     case
                       when coalesce(inv.track_inventory, false)
                            and not coalesce(inv.allow_backorder, false)
                         then greatest(inv.quantity - inv.reserved_quantity, 0)
                       else 2147483647
                     end
  ))
  into v_lineas
  from (
    select (l ->> 'variant_id')::uuid as variant_id, (l ->> 'quantity')::int as quantity
    from jsonb_array_elements(v_pedidas) l
  ) r
  join public.product_variants v on v.id = r.variant_id and v.is_active
  join public.products p on p.id = v.product_id and p.status = 'active'
  left join public.inventory inv on inv.variant_id = v.id;

  if v_lineas is null
     or jsonb_array_length(v_lineas) <> jsonb_array_length(v_pedidas) then
    raise exception 'Alguno de los productos ya no está disponible para la venta.'
      using errcode = 'P0002';
  end if;

  select (l ->> 'variant_id')::uuid into v_sin_stock
  from jsonb_array_elements(v_lineas) l
  where (l ->> 'available')::bigint < (l ->> 'quantity')::int
  limit 1;

  if v_sin_stock is not null then
    raise exception 'Stock insuficiente para la variante %.', v_sin_stock
      using errcode = 'P0003';
  end if;

  select coalesce(sum(round((l ->> 'unit_price')::numeric * (l ->> 'quantity')::int, 2)), 0)
  into v_subtotal
  from jsonb_array_elements(v_lineas) l;

  -- 4. Ficha de cliente. AQUÍ está el cambio de esta migración (#10).
  select c.id, c.profile_id into v_ficha_id, v_ficha_profile
  from public.customers c
  where c.email = p_email;

  if v_ficha_id is not null
     and v_ficha_profile is not null
     and (p_profile_id is null or p_profile_id <> v_ficha_profile) then
    -- El correo es de una cuenta registrada y quien compra no ha demostrado ser
    -- esa cuenta. Ni se adjudica el pedido ni se toca la ficha: el pedido queda
    -- con el correo, alcanzable por su enlace de confirmación y por el panel.
    v_customer_id := null;
  else
    insert into public.customers (email, first_name, last_name, phone)
    values (p_email, p_first_name, p_last_name, p_phone)
    on conflict (email) do update
      set first_name = coalesce(public.customers.first_name, excluded.first_name),
          last_name  = coalesce(public.customers.last_name, excluded.last_name),
          phone      = coalesce(public.customers.phone, excluded.phone),
          updated_at = now()
    returning id into v_customer_id;
  end if;

  -- 5. Descuento. Con `v_customer_id` nulo el límite por persona no aplica, que
  --    es lo correcto: aplicarlo contra la ficha ajena consumiría la cuota de
  --    esa persona, y sería una forma de fastidiarla desde fuera.
  if p_discount_code is not null and length(trim(p_discount_code)) > 0 then
    select d.discount_id, d.amount into v_discount_id, v_discount
    from public.validate_discount(p_discount_code, v_subtotal, v_customer_id) d
    where d.is_valid;

    if not found then
      raise exception 'El código de descuento no es válido.' using errcode = 'P0004';
    end if;
  end if;

  v_discount := least(coalesce(v_discount, 0), v_subtotal);

  if p_shipping_method_id is not null then
    select * into v_method
    from public.shipping_methods
    where id = p_shipping_method_id and is_active;

    if not found then
      raise exception 'El método de envío no está disponible.' using errcode = 'P0005';
    end if;

    v_shipping := case
      when v_method.free_above_subtotal is not null
           and (v_subtotal - v_discount) >= v_method.free_above_subtotal then 0
      else v_method.price
    end;

    v_shipping_snapshot := jsonb_build_object(
      'id', v_method.id, 'name', v_method.name, 'price', v_shipping
    );
  end if;

  v_total := round(v_subtotal - v_discount + v_shipping, 2);

  insert into public.orders (
    customer_id, email, phone, subtotal, discount_total, shipping_total, total,
    discount_code, shipping_address, shipping_method, customer_note
  )
  values (
    v_customer_id, p_email, p_phone, v_subtotal, v_discount, v_shipping, v_total,
    nullif(trim(coalesce(p_discount_code, '')), ''), p_shipping_address,
    v_shipping_snapshot, p_customer_note
  )
  returning id, public.orders.order_number, public.orders.confirmation_token
  into v_order_id, v_order_number, v_token;

  insert into public.order_items (
    order_id, variant_id, product_id, product_title, variant_title, sku,
    unit_price, quantity, total
  )
  select
    v_order_id,
    (l ->> 'variant_id')::uuid,
    (l ->> 'product_id')::uuid,
    l ->> 'product_title',
    l ->> 'variant_title',
    l ->> 'sku',
    (l ->> 'unit_price')::numeric,
    (l ->> 'quantity')::int,
    round((l ->> 'unit_price')::numeric * (l ->> 'quantity')::int, 2)
  from jsonb_array_elements(v_lineas) l;

  update public.inventory i
  set reserved_quantity = i.reserved_quantity + (l ->> 'quantity')::int
  from jsonb_array_elements(v_lineas) l
  where i.variant_id = (l ->> 'variant_id')::uuid
    and i.track_inventory;

  -- 10. El canje solo se registra si hay cliente: si no, no hay a quién
  --     contárselo, y anotarlo contra una ficha ajena era el mismo error.
  if v_discount_id is not null then
    if v_customer_id is not null then
      insert into public.discount_redemptions (discount_id, customer_id, order_id, amount)
      values (v_discount_id, v_customer_id, v_order_id, v_discount);
    end if;

    update public.discounts
    set usage_count = usage_count + 1
    where id = v_discount_id;
  end if;

  return query select v_order_id, v_order_number, v_token, v_subtotal, v_discount, v_shipping, v_total;
end;
$function$;

comment on function public.create_order(text, jsonb, jsonb, uuid, text, text, text, text, text, uuid) is
  'Crea un pedido de forma atómica. Un checkout de invitado NO se adjudica a la '
  'ficha de un correo que ya pertenece a una cuenta registrada, salvo que '
  'p_profile_id demuestre ser esa cuenta. Ver issue #10.';

-- La sobrecarga vieja se va: si se quedara, una llamada con nueve argumentos
-- seguiría entrando por la puerta que esta migración vino a cerrar.
drop function if exists public.create_order(text, jsonb, jsonb, uuid, text, text, text, text, text);

-- Y los privilegios se fijan a mano, porque la función es nueva y por defecto
-- PUBLIC puede ejecutarla.
revoke all on function public.create_order(text, jsonb, jsonb, uuid, text, text, text, text, text, uuid) from public;
revoke all on function public.create_order(text, jsonb, jsonb, uuid, text, text, text, text, text, uuid) from anon, authenticated;
grant execute on function public.create_order(text, jsonb, jsonb, uuid, text, text, text, text, text, uuid) to service_role;
