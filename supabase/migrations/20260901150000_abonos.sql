-- =============================================================================
-- 0027 · Abonos: el pedido sabe cuánto lleva pagado
-- =============================================================================
-- Fase L3 del plan de logística.
--
-- QUIÉN LLEVA LA CUENTA, Y POR QUÉ NO LA APLICACIÓN
--
-- `amount_paid` lo mantiene un disparador sobre `payments`, y `balance_due` es
-- una columna generada. Ninguna de las dos se escribe desde la aplicación, y es
-- deliberado: el dinero cobrado se toca desde el checkout, desde el webhook de
-- la pasarela y desde el panel cuando alguien registra un abono en efectivo.
-- Tres sitios que escriben el mismo número acaban discrepando, y el día que
-- discrepen nadie sabrá cuál de los tres creer.
--
-- Con esto, sumar los pagos y decidir el estado ocurre en un solo lugar: donde
-- están los pagos.
--
-- QUÉ CUENTA COMO PAGADO
--
-- Solo los pagos en estado `paid`. Un pago `pending` es una intención —una
-- pasarela que aún no confirmó, una transferencia que nadie ha visto entrar— y
-- despachar mercancía contra una intención es exactamente lo que esta fase
-- existe para evitar.
-- =============================================================================

-- --- 1. Las dos columnas ----------------------------------------------------
alter table public.orders
  add column if not exists amount_paid numeric(12, 2) not null default 0
    check (amount_paid >= 0);

-- Generada, no calculada por nadie: es imposible que se desincronice del total
-- y de lo pagado porque no existe fuera de esos dos.
alter table public.orders
  drop column if exists balance_due;
alter table public.orders
  add column balance_due numeric(12, 2)
    generated always as (greatest(total - amount_paid, 0)) stored;

comment on column public.orders.amount_paid is
  'Suma de los pagos en estado paid. Lo mantiene un disparador: no se escribe desde la aplicación.';
comment on column public.orders.balance_due is
  'Lo que falta por cobrar. Columna generada: no puede desincronizarse.';

create index if not exists orders_balance_due_idx on public.orders (balance_due)
  where balance_due > 0;

-- --- 2. El disparador que lleva la cuenta -----------------------------------
create or replace function public.recalcular_saldo_del_pedido()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  id_pedido uuid := coalesce(new.order_id, old.order_id);
  cobrado numeric(12, 2);
  total_pedido numeric(12, 2);
  estado_actual public.payment_status;
  estado_nuevo public.payment_status;
begin
  select coalesce(sum(p.amount), 0) into cobrado
  from public.payments p
  where p.order_id = id_pedido and p.status = 'paid';

  select o.total, o.payment_status into total_pedido, estado_actual
  from public.orders o where o.id = id_pedido;

  if total_pedido is null then
    return coalesce(new, old);
  end if;

  -- La misma regla que `estadoDePagoSegunSaldo` en @nebula/domain. Aquí manda
  -- la base: es el único sitio por el que pasan todos los caminos.
  estado_nuevo := case
    when cobrado <= 0 then 'pending'::public.payment_status
    when cobrado >= total_pedido then 'paid'::public.payment_status
    else 'partially_paid'::public.payment_status
  end;

  -- Los estados que no hablan de cuánto entró no se pisan. Un pedido devuelto
  -- o cancelado no vuelve a «pendiente» porque se borre un pago.
  if estado_actual in ('refunded', 'partially_refunded', 'cancelled', 'failed') then
    estado_nuevo := estado_actual;
  end if;

  update public.orders
  set amount_paid = cobrado,
      payment_status = estado_nuevo
  where id = id_pedido
    and (amount_paid is distinct from cobrado or payment_status is distinct from estado_nuevo);

  return coalesce(new, old);
end;
$$;

comment on function public.recalcular_saldo_del_pedido() is
  'Mantiene orders.amount_paid y el estado de pago a partir de los pagos en estado paid.';

revoke all on function public.recalcular_saldo_del_pedido() from public, anon, authenticated;

drop trigger if exists recalcular_saldo_del_pedido on public.payments;
create trigger recalcular_saldo_del_pedido
  after insert or update or delete on public.payments
  for each row execute function public.recalcular_saldo_del_pedido();

-- Los pedidos que ya existen quedan al día.
update public.orders o
set amount_paid = coalesce((
  select sum(p.amount) from public.payments p
  where p.order_id = o.id and p.status = 'paid'
), 0)
where o.amount_paid is distinct from coalesce((
  select sum(p.amount) from public.payments p
  where p.order_id = o.id and p.status = 'paid'
), 0);

-- --- 3. La regla que decide si se despacha (D4) ------------------------------
-- Se guarda en `settings` y no en el código: el día que la dueña quiera pasar
-- de «no sale hasta pagarlo todo» a «sale con el 50 %» no debería hacer falta
-- un despliegue.
--
-- El valor por defecto es el estricto porque es el único de los tres que no
-- puede acabar en pérdida. Las otras dos políticas son decisiones que alguien
-- tiene que tomar a sabiendas; ninguna debería activarse sola.
insert into public.settings (key, value, description, is_public)
values (
  'dispatch_policy',
  '{"politica": "estricta", "umbralPorcentaje": 50}'::jsonb,
  'Cuándo se deja salir un pedido con saldo: estricta, umbral o contra_entrega.',
  false
)
on conflict (key) do nothing;

-- --- 4. Que la regla no se pueda saltar -------------------------------------
-- Igual que con la máquina de estados de los envíos: la comprobación está en la
-- aplicación para poder avisar con un mensaje útil, y repetida aquí para que sea
-- de verdad. Un envío que sale sin haber cobrado lo que tocaba es mercancía en
-- la calle contra una promesa, y eso no se arregla con una pantalla más amable.
create or replace function public.guard_despacho_con_saldo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  regla jsonb;
  politica text;
  umbral numeric;
  total_pedido numeric(12, 2);
  cobrado numeric(12, 2);
  minimo numeric(12, 2);
begin
  -- Solo se comprueba al salir del almacén. Asignar o preparar un envío con
  -- saldo pendiente es normal: lo que no puede es irse.
  if new.status not in ('recogido', 'en_ruta') then
    return new;
  end if;

  if old.status in ('recogido', 'en_ruta') then
    return new;
  end if;

  select o.total, o.amount_paid into total_pedido, cobrado
  from public.orders o where o.id = new.order_id;

  if total_pedido is null or total_pedido <= 0 or cobrado >= total_pedido then
    return new;
  end if;

  select s.value into regla from public.settings s where s.key = 'dispatch_policy';

  politica := coalesce(regla ->> 'politica', 'estricta');
  umbral := least(greatest(coalesce((regla ->> 'umbralPorcentaje')::numeric, 50), 0), 100);

  if politica = 'contra_entrega' then
    return new;
  end if;

  if politica = 'umbral' then
    minimo := round(total_pedido * umbral / 100, 2);
    if cobrado >= minimo then
      return new;
    end if;

    raise exception 'No se puede despachar: faltan % para alcanzar el % %% que exige la regla de despacho.',
      to_char(minimo - cobrado, 'FM999999990.00'), umbral
      using errcode = '23514';
  end if;

  raise exception 'No se puede despachar: quedan % por cobrar y la regla exige saldo cero.',
    to_char(total_pedido - cobrado, 'FM999999990.00')
    using errcode = '23514';
end;
$$;

comment on function public.guard_despacho_con_saldo() is
  'Impide que un envío salga del almacén si la regla de despacho (settings.dispatch_policy) no se cumple.';

revoke all on function public.guard_despacho_con_saldo() from public, anon, authenticated;

drop trigger if exists guard_despacho_con_saldo on public.shipments;
create trigger guard_despacho_con_saldo
  before update on public.shipments
  for each row execute function public.guard_despacho_con_saldo();
