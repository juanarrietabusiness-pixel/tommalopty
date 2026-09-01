-- =============================================================================
-- 0029 · La referencia de un abono no es un identificador de pasarela
-- =============================================================================
-- Fallo encontrado al registrar el segundo abono de un pedido de prueba.
--
-- QUÉ PASABA
--
-- La acción del panel guardaba la referencia que escribe quien cobra —«efectivo
-- en tienda», «transferencia», el nombre de quien lo recibió— en
-- `provider_payment_id`. Esa columna tiene un índice único por
-- `(provider, provider_payment_id)`, puesto para lo que se puso: que la misma
-- confirmación de una pasarela no entre dos veces.
--
-- Con abonos manuales eso es exactamente lo contrario de lo que hace falta. Dos
-- abonos del mismo pedido, o de pedidos distintos, con la misma palabra escrita
-- —y «efectivo» se va a repetir cada día— chocaban con un error de clave
-- duplicada. El mensaje que veía quien cobra hablaba de una restricción de base
-- de datos, no de lo que había pasado.
--
-- LA CORRECCIÓN
--
-- Una columna propia, sin restricción de unicidad, porque una referencia escrita
-- a mano no identifica nada: solo ayuda a recordar de dónde salió el dinero.
-- `provider_payment_id` se queda para lo que es, el identificador que devuelve
-- la pasarela.
-- =============================================================================

alter table public.payments
  add column if not exists reference text;

comment on column public.payments.reference is
  'Nota de quien registró el pago: número de transferencia, comprobante, quién lo recibió. No identifica nada y por eso no es única.';
comment on column public.payments.provider_payment_id is
  'Identificador que devuelve la pasarela. Único por proveedor: es lo que impide procesar dos veces la misma confirmación.';

-- Los abonos ya registrados a mano se mueven a su columna, y sueltan el índice
-- único que no les correspondía.
update public.payments
set reference = provider_payment_id,
    provider_payment_id = null
where provider = 'manual' and provider_payment_id is not null;
