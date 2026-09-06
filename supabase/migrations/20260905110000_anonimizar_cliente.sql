-- Anonimizar un cliente (issue #46)
--
-- LA PREGUNTA QUE VINO A RESPONDER
--
-- «¿Por qué no puedo eliminar un cliente?» Porque borrar la ficha se lleva por
-- delante lo que no se puede perder: `orders.customer_id` es `on delete set
-- null`, así que los pedidos sobrevivirían huérfanos, pero las direcciones, las
-- notas del CRM y los favoritos van en cascada, y sobre todo la contabilidad se
-- queda sin a quién atribuir una venta que sí ocurrió y que hay que declarar.
--
-- Lo que de verdad se pide cuando alguien dice «bórralo» casi nunca es perder
-- la venta: es que sus datos personales dejen de estar. Eso es anonimizar, y es
-- también lo que exige un derecho de supresión bien entendido — el importe de
-- una factura no es un dato personal, el teléfono de su casa sí.
--
-- QUÉ SE VA Y QUÉ SE QUEDA
--
-- Se va todo lo que señala a una persona:
--   · Ficha: correo, nombre, apellido, teléfono, etiquetas y el consentimiento
--     de marketing (que sin correo al que escribir no significa nada).
--   · Direcciones guardadas: se borran. Son la puerta de su casa.
--   · Notas del CRM: se borran. Es texto libre que el equipo escribió sobre
--     esa persona, y no hay forma de anonimizar una frase.
--   · Favoritos y carritos: se borran. Es lo que miró, no lo que compró.
--   · Suscripciones (`leads`) con ese correo: se borran.
--   · En cada pedido: correo, teléfono y la nota del cliente. De la dirección
--     guardada dentro del pedido se conserva SOLO ciudad y provincia — hace
--     falta para el informe de ventas por zona y no señala a nadie— y se tiran
--     calle, número, referencia, nombre y teléfono.
--   · En cada envío: lo mismo con el destino, y las coordenadas a null. Una
--     coordenada es la puerta de casa de alguien con seis decimales.
--   · En las reseñas: el nombre del autor pasa a «Cliente anónimo». La reseña
--     se queda: es una opinión sobre un producto, y borrarla cambiaría la nota
--     media de un producto por un motivo que no tiene que ver con el producto.
--
-- Se queda todo lo que es de la tienda y no de la persona: los pedidos con sus
-- números, importes, artículos y pagos; los envíos con sus guías; la bitácora.
--
-- QUÉ NO PUEDE HACER ESTA FUNCIÓN, Y POR QUÉ LO DEVUELVE
--
-- Dos cosas viven fuera de Postgres y esta función solo las puede señalar:
--
--   · La cuenta de acceso (`auth.users`), que guarda el correo de verdad. Se
--     devuelve `profile_id` para que quien llame la borre con la API de admin.
--   · Las fotos de prueba de entrega, que están en el bucket privado de R2. Se
--     devuelven sus claves para que quien llame las borre.
--
-- Devolverlas en vez de intentarlas es lo que impide el peor final posible:
-- una anonimización que informa de éxito y deja el correo en la tabla de
-- autenticación y la foto de la puerta de su casa en un bucket.
--
-- NO ES REVERSIBLE, Y ESO ES EL PUNTO
--
-- No se guarda copia de lo que se sustituye. Una anonimización con vuelta atrás
-- no es una anonimización: es un cifrado con la llave al lado.

create or replace function public.anonimizar_cliente(p_customer_id uuid)
returns table (
  email_anterior      text,
  pedidos             integer,
  direcciones         integer,
  notas               integer,
  resenas             integer,
  suscripciones       integer,
  envios              integer,
  -- Lo que queda por borrar FUERA de Postgres. Ver la cabecera.
  pruebas_de_entrega  text[],
  cuenta_de_acceso    uuid
)
language plpgsql
security definer
set search_path = public, extensions
as $function$
declare
  v_ficha       public.customers%rowtype;
  v_email_nuevo text;
  v_pedidos     uuid[];
begin
  -- La comprobación va aquí y no solo en el panel: la función corre como su
  -- dueño y se salta RLS, así que sin esto cualquier sesión autenticada podría
  -- anonimizar a cualquiera con una sola llamada.
  if not public.is_superadmin() then
    raise exception 'Solo un superadministrador puede anonimizar un cliente.'
      using errcode = '42501';
  end if;

  select * into v_ficha from public.customers where id = p_customer_id;

  if not found then
    raise exception 'Ese cliente ya no existe.' using errcode = 'P0002';
  end if;

  email_anterior := v_ficha.email::text;

  -- `.invalid` está reservado por el RFC 2606: nunca va a ser el dominio de
  -- nadie, así que este correo no puede colisionar con una persona real ni
  -- recibir por accidente un envío de marketing. Lleva el id para no chocar con
  -- el índice único cuando se anonimiza a más de uno.
  v_email_nuevo := 'anonimo+' || replace(p_customer_id::text, '-', '') || '@anonimo.invalid';

  if v_ficha.email::text = v_email_nuevo then
    raise exception 'Ese cliente ya está anonimizado.' using errcode = 'P0001';
  end if;

  select coalesce(array_agg(o.id), '{}') into v_pedidos
  from public.orders o where o.customer_id = p_customer_id;

  -- --- 1. Lo que se borra entero -------------------------------------------
  delete from public.addresses where customer_id = p_customer_id;
  get diagnostics direcciones = row_count;

  delete from public.crm_notes where customer_id = p_customer_id;
  get diagnostics notas = row_count;

  delete from public.leads
  where customer_id = p_customer_id or email = v_ficha.email;
  get diagnostics suscripciones = row_count;

  -- Los carritos se borran en vez de desligarse: `carts_owner_present` exige
  -- dueño, y dejarles el `session_token` los devolvería a un navegador.
  delete from public.carts where customer_id = p_customer_id;
  delete from public.wishlists where customer_id = p_customer_id;

  -- --- 2. Las fotos de la puerta de su casa ---------------------------------
  -- Se leen ANTES de ponerlas a null, o se perdería la clave y con ella la
  -- única forma de encontrar el fichero en el bucket.
  select coalesce(array_agg(s.delivery_proof_key), '{}') into pruebas_de_entrega
  from public.shipments s
  where s.order_id = any (v_pedidos) and s.delivery_proof_key is not null;

  -- --- 3. Lo que se conserva, sin la persona dentro -------------------------
  update public.orders o
  set email          = v_email_nuevo,
      phone          = null,
      customer_note  = null,
      shipping_address = case
        when o.shipping_address is null then null
        else jsonb_strip_nulls(jsonb_build_object(
          'city',     o.shipping_address ->> 'city',
          'province', o.shipping_address ->> 'province'
        ))
      end
  where o.id = any (v_pedidos);
  get diagnostics pedidos = row_count;

  -- Aquí no hay rama para el nulo, y en `orders` sí: `shipments.destination` es
  -- `not null default '{}'`, así que un envío sin destino es un objeto vacío.
  update public.shipments s
  set destination = jsonb_strip_nulls(jsonb_build_object(
        'city',     s.destination ->> 'city',
        'province', s.destination ->> 'province'
      )),
      latitude  = null,
      longitude = null,
      -- El motivo de un fallo lo escribe una persona y suele nombrar a otra:
      -- «no estaba, dice el vecino que trabaja hasta las seis».
      failure_reason      = null,
      delivery_proof_key  = null
  where s.order_id = any (v_pedidos);
  get diagnostics envios = row_count;

  update public.reviews
  set author_name = 'Cliente anónimo'
  where customer_id = p_customer_id;
  get diagnostics resenas = row_count;

  update public.customers
  set email               = v_email_nuevo::extensions.citext,
      first_name          = 'Cliente',
      last_name           = 'anonimizado',
      phone               = null,
      accepts_marketing   = false,
      marketing_opt_in_at = null,
      tags                = '{}'
  where id = p_customer_id;

  -- --- 4. La cuenta de acceso, si la había ----------------------------------
  cuenta_de_acceso := v_ficha.profile_id;

  if v_ficha.profile_id is not null then
    -- Se desactiva ya, para que no pueda entrar mientras quien llama termina de
    -- borrar la cuenta en `auth.users`. Si esa segunda mitad falla, lo peor que
    -- queda es una cuenta muerta, no una cuenta viva sobre datos anonimizados.
    update public.profiles
    set is_active = false,
        full_name = null,
        phone     = null
    where id = v_ficha.profile_id;
  end if;

  return next;
end;
$function$;

comment on function public.anonimizar_cliente(uuid) is
  'Borra los datos personales de un cliente conservando pedidos, importes y envíos. Solo superadmin. Devuelve lo que queda por borrar FUERA de Postgres: la cuenta de auth y las fotos de prueba de entrega en R2. Ver issue #46.';

-- Privilegios a mano: una función nueva la puede ejecutar PUBLIC por defecto.
revoke all on function public.anonimizar_cliente(uuid) from public;
revoke all on function public.anonimizar_cliente(uuid) from anon;
-- `authenticated` sí, porque el panel llama con la sesión de quien pulsa: es lo
-- que permite que `is_superadmin()` de dentro signifique algo.
grant execute on function public.anonimizar_cliente(uuid) to authenticated, service_role;
