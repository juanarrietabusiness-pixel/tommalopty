-- =============================================================================
-- validate_discount: el cliente sale de la sesión, no del parámetro (#8)
-- =============================================================================
-- PROBLEMA
--
-- `validate_discount(text, numeric, uuid)` está concedida a `anon` y
-- `authenticated` —tiene que estarlo: la tienda valida un código antes del
-- checkout, sin sesión—, y recibe el `customer_id` como parámetro libre. Desde
-- el navegador, con la anon key, eso permite **sondear el límite por persona**
-- de un cupón pasando `customer_id` ajenos: la función responde distinto según
-- cuántas veces lo haya canjeado ese cliente. Es una fuga de información sobre
-- terceros.
--
-- (La enumeración de códigos a fuerza bruta es el otro vector del issue #8, y
-- ese es de límite de tasa por IP en el borde, no de la base: se anota como
-- pendiente de infraestructura, no se resuelve aquí.)
--
-- SOLUCIÓN
--
-- El `customer_id` del parámetro solo se honra cuando la llamada viene de un
-- contexto de confianza: el servidor con `service_role`, que es exactamente cómo
-- `create_order` la invoca (pasándole el cliente que acaba de resolver por
-- correo, para comprobar el límite por persona al confirmar el pedido).
--
-- Desde el navegador —`anon` o `authenticated`— el cliente se deduce de la
-- sesión con `current_customer_id()`, y el parámetro se ignora: un visitante
-- solo puede comprobar su propio historial, nunca el de otro. Un anónimo no
-- tiene historial, así que el límite por persona simplemente no aplica.
--
-- La firma no cambia (mismo `(text, numeric, uuid default null)`), así que los
-- tipos generados y los grants existentes siguen igual; solo cambia el cuerpo.
-- =============================================================================

create or replace function public.validate_discount(
  p_code text,
  p_subtotal numeric,
  p_customer_id uuid default null
)
returns table (
  discount_id uuid,
  code text,
  type public.discount_type,
  amount numeric,
  is_valid boolean,
  reason text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  d public.discounts%rowtype;
  used_by_customer integer := 0;
  v_customer_id uuid;
begin
  -- El parámetro solo lo fija quien es de fiar. `create_order` corre con
  -- `service_role` y pasa el cliente real; cualquier otra llamada llega del
  -- navegador y el cliente se deduce de la sesión, ignorando lo que venga en
  -- `p_customer_id`. `auth.role()` lee el rol del JWT de la petición, y ese
  -- valor sobrevive a la llamada anidada desde `create_order`.
  if auth.role() = 'service_role' then
    v_customer_id := p_customer_id;
  else
    v_customer_id := public.current_customer_id();
  end if;

  select * into d from public.discounts
  where public.discounts.code = p_code::extensions.citext
  limit 1;

  if not found then
    return query select null::uuid, p_code, null::public.discount_type, 0::numeric, false,
                        'Código no encontrado';
    return;
  end if;

  if not d.is_active
     or d.starts_at > now()
     or (d.ends_at is not null and d.ends_at < now()) then
    return query select d.id, d.code::text, d.type, 0::numeric, false, 'Código expirado o inactivo';
    return;
  end if;

  if d.usage_limit is not null and d.usage_count >= d.usage_limit then
    return query select d.id, d.code::text, d.type, 0::numeric, false, 'Código agotado';
    return;
  end if;

  if v_customer_id is not null and d.usage_limit_per_customer is not null then
    select count(*) into used_by_customer
    from public.discount_redemptions r
    where r.discount_id = d.id and r.customer_id = v_customer_id;

    if used_by_customer >= d.usage_limit_per_customer then
      return query select d.id, d.code::text, d.type, 0::numeric, false,
                          'Límite de usos por cliente alcanzado';
      return;
    end if;
  end if;

  if p_subtotal < d.min_subtotal then
    return query select d.id, d.code::text, d.type, 0::numeric, false,
                        format('Requiere un subtotal mínimo de %s', d.min_subtotal);
    return;
  end if;

  return query select
    d.id,
    d.code::text,
    d.type,
    case d.type
      when 'percentage'   then round(p_subtotal * d.value / 100, 2)
      when 'fixed_amount' then least(d.value, p_subtotal)
      else 0::numeric
    end,
    true,
    null::text;
end;
$$;

comment on function public.validate_discount(text, numeric, uuid) is
  'Valida un código de descuento. El customer para el límite por persona sale de '
  'la sesión (current_customer_id); el parámetro p_customer_id solo se honra si la '
  'llamada viene de service_role, como hace create_order. Ver issue #8.';
