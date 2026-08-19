# Pasarelas de pago para Panamá

## El punto de partida

**Stripe no opera con comercios domiciliados en Panamá.** Su cobertura en
Latinoamérica se limita a Brasil y México. Esto no es un detalle de
configuración: condiciona la arquitectura del checkout, porque la mayoría de
tutoriales y librerías de e-commerce asumen Stripe.

Por eso el checkout se diseñó desacoplado desde el principio (ver
`packages/integrations/src/payments/types.ts`): el frontend habla con una
interfaz común y las pasarelas son intercambiables por variable de entorno.

> Alternativa si en algún momento se quiere Stripe: constituir una entidad en un
> país soportado (p. ej. EE. UU.). Es práctica común, pero implica trámites
> legales y fiscales — coordinarlo con contador y abogado antes de asumir esa
> ruta.

## Opciones evaluadas

| Pasarela                  | Métodos                          | Coste de referencia      | Notas                                                                           |
| ------------------------- | -------------------------------- | ------------------------ | ------------------------------------------------------------------------------- |
| **PayPal Checkout**       | PayPal + tarjeta                 | Comisión por transacción | Cobertura internacional, la más reconocida por compradores. Integración simple. |
| **Wompi (Banistmo)**      | Visa/Mastercard crédito y débito | ~2.75 % + $0.25          | Tarjetas locales, integración razonable.                                        |
| **PagueloFacil**          | Tarjetas, Clave, cripto          | Sin coste de setup       | Requiere cuenta bancaria local.                                                 |
| **Yappy (Banco General)** | QR                               | ~1 %                     | Muy extendido en Panamá para compras locales.                                   |
| CROEM / BAC / Credicorp   | Tarjetas                         | Setup mensual            | Pasarelas bancarias tradicionales, más coste fijo.                              |

_Las comisiones son orientativas y dependen del contrato de cada comercio.
Confirmarlas con el proveedor antes de decidir._

## Recomendación de arranque

**PayPal + Wompi (o PagueloFacil).** Cubre compradores internacionales y
tarjetas locales a la vez. Es la combinación activa por defecto:

```bash
PAYMENTS_ENABLED_PROVIDERS=paypal,wompi
```

Yappy es un buen tercer método si el público es mayoritariamente local; ya tiene
su adaptador preparado, basta con añadirlo a la lista.

## Estado de la implementación

Los cuatro adaptadores existen con su interfaz completa y su documentación de
implementación, pero **los métodos todavía no están implementados**: lanzan
`NotImplementedError` con un mensaje explícito.

Lo que sí está hecho y funcionando:

- El registro que decide qué pasarelas se ofrecen (`registry.ts`).
- El checkout completo: validación, cálculo de totales y creación del pedido.
- El endpoint de webhooks, con idempotencia y registro de eventos.
- La interfaz del panel que muestra qué integraciones tienen credenciales.

Cuando el pedido se crea pero la pasarela no está lista, queda registrado como
pendiente con un evento en su bitácora y se avisa al comprador con claridad. En
ningún caso se da por pagado.

## Cómo implementar una pasarela

1. Abre el adaptador en `packages/integrations/src/payments/providers/`. El
   comentario de cabecera lista los endpoints y el orden de llamadas.
2. Implementa `createPayment`, `capturePayment`, `refundPayment` y
   `verifyWebhook`.
3. Carga las credenciales como variables de entorno (nombres en `.env.example`).
   **Nunca en la base de datos.**
4. Actívala en `PAYMENTS_ENABLED_PROVIDERS` y en el panel
   (**Integraciones**), primero en sandbox.
5. Prueba el flujo completo, incluido el webhook, antes de pasar a producción.

## Reglas que no se negocian

- **Nunca se almacenan datos de tarjeta.** La tokenización ocurre siempre en el
  widget o SDK del proveedor; por nuestro servidor solo circulan
  identificadores. El cumplimiento PCI-DSS recae en el proveedor.
- **La firma del webhook se verifica siempre.** Un webhook sin verificar es una
  puerta abierta para marcar pedidos como pagados.
- **El estado del pago lo decide el webhook**, no la vuelta del navegador.
- **Los importes se calculan en servidor**, nunca se aceptan del cliente.
- **La moneda es USD**, sin conversión: Panamá usa dólar americano.
