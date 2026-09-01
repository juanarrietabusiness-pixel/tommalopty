# Yappy, los dos

> Escrito porque la confusión cuesta un día entero y la hemos pagado ya.

Yappy vende **dos cosas distintas con el mismo nombre**, cada una con su portal,
su documentación y sus credenciales. Las credenciales de una devuelven un error
genérico en la otra, así que lo primero, siempre, es saber cuál se tiene.

|                    | **Botón de Pago**                                       | **Integración Core** («Apificación») |
| ------------------ | ------------------------------------------------------- | ------------------------------------ |
| Para qué sirve     | Cobrar en el checkout                                   | Leer lo ya cobrado                   |
| ¿Mueve dinero?     | Sí                                                      | **No**                               |
| Credenciales       | ID de comercio, clave secreta, dominio                  | API Key, Secret Key (+ host)         |
| Dónde vive aquí    | `packages/integrations/src/payments/providers/yappy.ts` | `packages/integrations/src/yappy/`   |
| Estado             | ⛔ Falta la especificación oficial                      | ✅ Implementado y probado            |
| A quién se le pide | `botondepagoyappy@bgeneral.com`                         | `integracionesdev@yappy.com.pa`      |

La documentación que hay en el repositorio (el manual v1.0.0 y su
`Yappy-Commerce-Integration.yml` v1.1.0) es la de la **Integración Core**. No
trae ningún endpoint que cobre: son sesión, historial de movimientos y métodos
de cobro.

---

## 1 · Integración Core: conciliar los cobros

### Qué resuelve

Hoy los abonos se apuntan a mano: alguien abre la app del banco, ve que entró un
pago, busca de quién es y lo registra en el panel. Aguanta cinco pedidos al día.
Yappy sabe qué entró y cuándo; lo que no sabe es a qué pedido corresponde, y eso
solo lo sabe esta tienda.

### Las tres variables

```bash
YAPPY_API_URL=          # host de la API
YAPPY_API_KEY=          # «API Key» del portal
YAPPY_API_SECRET_KEY=   # «Secret Key» del portal
```

Las dos claves salen de **Yappy Comercial → Integraciones → Generar
credenciales**. Genera unas nuevas y **las anteriores dejan de servir**: si algo
se rompe justo después de tocar el portal, es esto.

`YAPPY_API_URL` **no sale de la documentación**. La especificación trae
`http://localhost:3000` como marcador de posición («path relativo global»), así
que el host real lo da Yappy al habilitar el comercio. Sin él no se puede llamar
a nada, y es lo primero que hay que pedirles.

### Comprobar que sirven

```bash
YAPPY_API_URL=… YAPPY_API_KEY=… YAPPY_API_SECRET_KEY=… \
  pnpm --filter @nebula/integrations yappy:validar
```

Hace las tres llamadas en orden y dice **cuál fue la primera que falló**. No
escribe nada: se puede ejecutar contra producción. Existe porque toda la
integración cuelga de un hash que se calcula a ciegas, y cuando está mal Yappy
responde `YP-0006, error al procesar los datos` sin decir si el problema es la
clave, la fecha, el host o la cabecera.

Si sale bien, imprime además los **alias de los métodos de cobro**, que es lo que
hace falta para filtrar el historial más adelante.

### El código de sesión

Es lo único de toda la integración que no se puede consultar en ningún sitio si
sale mal. La receta está en el manual (§ «Generación del código para inicio de
sesión»):

```
HMAC-SHA256( clave = Secret Key, mensaje = API Key + fecha )   → hexadecimal
```

La fecha va en `YYYY-MM-DD` y es **la de Panamá**, no la del servidor. Esto no es
un detalle: la tienda corre en Cloudflare, en UTC, y entre las 19:00 y la
medianoche de Panamá el día UTC ya cambió. Con la fecha del servidor, la sesión
dejaría de abrirse cada tarde y volvería a funcionar sola por la mañana — el tipo
de fallo que se persigue durante semanas. Hay un test que lo fija
(`codigo.test.ts`, «a las 23:00 UTC sigue siendo el día anterior en Panamá»).

### Lo que queda por confirmar con Yappy

Una sola cosa, y es de una línea: **los nombres exactos de las dos cabeceras de
credenciales**. La especificación las declara como esquemas `Api-Key` y
`Secret-Key`, pero en el campo `name` pone «API Key» y «API secret Key», con
espacios, que no son nombres de cabecera válidos. Se usan los identificadores
del esquema. Si el login responde `YP-0008` (faltan cabeceras obligatorias),
esto es lo primero que hay que cambiar: están con nombre propio arriba de
`cliente.ts`.

### Cómo empareja los cobros con los pedidos

`conciliacion.ts`, puro y con sus tests. Un movimiento cuenta como cobro solo si
entra dinero (`role: CREDIT`), está `COMPLETED` o `EXECUTED`, es en dólares y
trae importe. Después busca el número de pedido:

1. **Por `referenceId`**, que es el campo que existe justo para eso → certeza
   `referencia`.
2. **Dentro del concepto** (`description` / `bill_description`), con fronteras a
   los lados para que `NB-001234` no haga juego dentro de `NB-0012345` → certeza
   `descripcion`.

**No decide sola.** Solo se registran sin preguntar los cobros con certeza
`referencia` que no se pasan del saldo pendiente; el resto se enseña para que una
persona confirme. La regla es conservadora a propósito: preguntar cuesta un clic
y acertar por accidente cuesta un pedido despachado sin cobrar.

Volver a conciliar el mismo rango de fechas **no cobra dos veces**: se le pasa el
conjunto de transacciones ya apuntadas. Y los rangos se solapan siempre, porque
es la única forma de no perder un pago que entró justo en el corte.

### Para que la conciliación acierte sola

Que el número de pedido viaje en la transacción. Si el cobro llega por el Botón
de Pago, va en su `orderId`; si llega por transferencia suelta, hay que pedirle
al cliente que lo ponga en el concepto. Sin eso todo cae en el segundo camino, y
el segundo camino siempre pasa por una persona.

---

## 2 · Botón de Pago: cobrar en el checkout

El adaptador está en el registro de pasarelas y el checkout ya sabe ofrecerlo:
se activa con `PAYMENTS_ENABLED_PROVIDERS=paypal,wompi,yappy` y sus credenciales
son `YAPPY_MERCHANT_ID`, `YAPPY_SECRET_KEY` y `YAPPY_DOMAIN_URL`.

Sus cuatro métodos **siguen lanzando `NotImplementedError`**, y es deliberado:
falla ruidosamente en vez de fingir un pago. Un pedido hecho con Yappy elegido
queda registrado como pendiente, con su evento en la bitácora y un aviso claro al
comprador; en ningún caso se da por pagado.

Lo que falta para implementarlo es la especificación de Banco General. De lo
publicado se sabe ya:

- Yappy confirma llamando a una URL del comercio con `orderId`, `status`,
  `confirmationNumber` y `hash` en la cadena de consulta.
- `status` vale `E` (ejecutado), `R` (rechazado: el cliente no confirmó en cinco
  minutos) o `C` (cancelado por el cliente en la app).

Lo que no se sabe, y sin lo cual no se puede escribir nada: el host de la API,
las rutas para crear la orden, y qué se concatena exactamente para el `hash`. Un
pago con endpoints adivinados no se prueba — se rompe con dinero de por medio.

Cuando llegue la documentación, lo único que hay que escribir son los cuatro
métodos del adaptador. Todo lo demás está y no se toca: el checkout, el endpoint
de webhooks con su idempotencia, el registro de eventos y la comprobación de que
el importe cobrado es el del pedido (`descuadreDeImporte`).

---

## Reglas que no cambian

- **El estado del pago lo decide el webhook**, nunca la vuelta del navegador.
- **La firma se verifica siempre.** Un webhook sin verificar es una puerta
  abierta para marcar pedidos como pagados.
- **Los importes se calculan en servidor** y se comparan con lo que la pasarela
  dice haber cobrado antes de tocar el pedido.
- **Las credenciales van en variables de entorno, nunca en la base de datos.**
  Es lo que permite que la dueña ponga las suyas sin que nadie toque código.
