# @nebula/integrations

Pasarelas de pago, Meta Conversions API y email transaccional.

## Pagos

El checkout habla con una sola interfaz (`PaymentProvider`), así que añadir o
quitar una pasarela no toca el frontend. Qué pasarelas se ofrecen lo decide una
variable de entorno:

```bash
PAYMENTS_ENABLED_PROVIDERS=paypal,wompi
```

**Stripe no está aquí a propósito**: no opera con comercios domiciliados en
Panamá. Ver [`docs/PAGOS-PANAMA.md`](../../docs/PAGOS-PANAMA.md).

### Estado: preparado, no implementado

Los cuatro adaptadores (`paypal`, `wompi`, `paguelofacil`, `yappy`) tienen la
interfaz completa y la documentación de implementación en su cabecera, pero sus
métodos lanzan `NotImplementedError`. Eso es deliberado: falla ruidosamente en
lugar de fingir un pago.

Para implementar uno:

1. Abre `src/payments/providers/<pasarela>.ts` — el comentario lista endpoints
   y orden de llamadas.
2. Implementa `createPayment`, `capturePayment`, `refundPayment` y
   `verifyWebhook`.
3. Carga las credenciales como variables de entorno (nombres en `.env.example`).

### Reglas

- Nunca se reciben ni almacenan datos de tarjeta: la tokenización ocurre en el
  widget del proveedor y aquí solo circulan identificadores.
- `verifyWebhook` debe verificar la firma **siempre** y ser idempotente: las
  pasarelas reintentan.

## Yappy Comercial (`src/yappy/`) — no es la pasarela

Ojo: **son dos productos con el mismo nombre**. El adaptador de `payments/` es
el _Botón de Pago_, que cobra. Esto otro es la _Integración Core_ o
«Apificación», que **no cobra**: abre sesión y lee los movimientos ya cobrados
para conciliarlos con los pedidos.

```bash
YAPPY_API_URL=… YAPPY_API_KEY=… YAPPY_API_SECRET_KEY=… \
  pnpm --filter @nebula/integrations yappy:validar
```

Ese comando hace las tres llamadas en orden y dice cuál falló primero. No
escribe nada. El detalle completo está en [`docs/YAPPY.md`](../../docs/YAPPY.md).

## Meta (Pixel + Conversions API)

`sendConversionEvent()` envía eventos desde el servidor, lo que evita la pérdida
de datos por bloqueadores de anuncios. Se combina con el Pixel del navegador
compartiendo `event_id` para que Meta deduplique.

Los datos personales se normalizan y hashean con SHA-256 antes de salir
(`hash.ts`), usando Web Crypto para funcionar igual en Node, Workers y Edge
Functions. La función nunca lanza: el marketing no puede tumbar un checkout.

La versión de la Graph API es configurable (`META_API_VERSION`); conviene
revisarla al menos una vez al año.

## Email

`resendProvider` envía por HTTP (sin SDK, para que funcione en cualquier
runtime). Las plantillas de `templates.ts` usan HTML inline y los colores de la
marca, porque los clientes de correo no soportan CSS moderno.

## Tests

```bash
pnpm --filter @nebula/integrations test
```

Cubren el registro de pasarelas y la normalización/hasheo de datos para Meta.
