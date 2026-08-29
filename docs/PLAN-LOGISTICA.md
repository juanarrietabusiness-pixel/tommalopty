# Plan de implementación · Trazabilidad, direcciones exactas, abonos y motorizados

> Documento de planificación. **Ninguna línea de código se escribe hasta que
> este plan esté aprobado y las decisiones de la sección 4 estén tomadas.**
>
> Complementa a [`PLAN.md`](PLAN.md) (el norte general del proyecto) y a
> [`ROADMAP.md`](ROADMAP.md) (estado por fases). Si algo aquí contradice al
> código, manda el código: este documento se actualiza.

---

## 1. Las preguntas de la clienta, respondidas en una línea

| Pregunta                                                             | Respuesta corta                                                   | Estado hoy   | Dónde se resuelve |
| -------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------ | ----------------- |
| ¿Podrá seguir sus pedidos?                                           | Sí, y ya hay media base construida                                | 🔶 Parcial   | Fase **L2**       |
| ¿El cliente pone la dirección en un mapa, como PedidosYa o inDriver? | Hoy no; es la pieza que más impacto tiene                         | 🔲 No existe | Fase **L1**       |
| ¿La guía lleva QR que abra Waze y Google Maps?                       | Hoy no hay guía; se construye con QR desde el primer día          | 🔲 No existe | Fase **L2**       |
| ¿Puede recibir abonos y despachar al completarse el pago?            | Hoy no; la base de datos ya aguanta varios pagos por pedido       | 🔲 No existe | Fase **L3**       |
| ¿Hay panel de clientes? ¿Vive sin clientes registrados?              | **Sí a las dos.** Ya está hecho y funcionando                     | ✅ Hecho     | —                 |
| ¿Cómo entra su comunidad de motorizados?                             | Es un módulo nuevo completo, con su propia app                    | 🔲 No existe | Fase **L4**       |
| ¿Y Servientrega, Droppy y demás?                                     | Como adaptadores intercambiables, igual que las pasarelas de pago | 🔲 No existe | Fase **L5**       |

---

## 2. Dónde estamos hoy — verificado contra el código

No es una impresión: es lo que hay en el repositorio a día de hoy.

### Lo que ya funciona

- **Dos aplicaciones desplegables**: tienda (`apps/storefront`) y panel
  administrativo (`apps/admin`), con 32 pantallas entre ambas.
- **34 tablas** con seguridad a nivel de fila (RLS) y **174 tests** automatizados,
  incluidos tests contra Postgres real.
- **Compra completa de punta a punta**: catálogo, búsqueda en español, carrito
  persistente, checkout que recalcula precios en el servidor, y creación de
  pedido dentro de una única transacción de base de datos (`create_order`), con
  reserva de inventario.
- **Compra como invitado**: no hace falta cuenta para comprar. El pedido se crea
  igual y se genera la ficha de cliente para el CRM.
- **Panel de cliente** (`/cuenta`): pedidos, detalle, direcciones guardadas y
  favoritos.
- **CRM de clientes en el panel** (`/clientes`): ficha, historial de compras,
  notas privadas y etiquetas.
- **Bitácora de pedidos**: cada cambio de estado y de estado de pago se registra
  solo, con autor y fecha, en la tabla `order_events`.
- **Emails transaccionales** enganchados a eventos reales: pedido recibido, pago
  confirmado, pedido enviado.
- **Página de confirmación con token opaco**: el pedido se consulta con un token
  de 48 caracteres, no con el número de pedido — enumerar URLs no expone el
  histórico de nadie.

### Lo que falta y bloquea el despliegue

Una sola cosa, y no es técnica: **una cuenta de Cloudflare y un dominio.** El
workflow de despliegue ya está escrito y duerme por falta de dos secretos
(`CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID`).

### Lo que falta del panel, ya identificado

Editor de menús, subida de imágenes, variantes múltiples, blog, reseñas,
campañas y edición de datos personales del cliente. Detallado en
[`PLAN.md` §Fase 0](PLAN.md).

### Lo que este documento añade

Todo lo logístico. Hoy el sistema sabe **qué** se vendió y **a quién**, pero no
sabe **dónde exactamente**, ni **quién lo lleva**, ni **cuánto se ha abonado**.
Eso es lo que se construye aquí.

---

## 3. Los dos dolores, y cómo se cierran

La clienta nombró dos. Todo el plan se ordena alrededor de ellos.

### Dolor 1 · «Que la compra sea fácil»

Ya está en gran parte resuelto: carrito que sobrevive a recargas, checkout de
una sola pantalla, compra sin registro obligatorio. Lo que falta:

- **La dirección es hoy el punto de fricción del checkout.** Escribir una
  dirección panameña a mano es lento y sale mal. El mapa la convierte en dos
  toques (Fase L1).
- **Abonos** (Fase L3): un ticket alto deja de ser una decisión de "todo o nada".

### Dolor 2 · «Trazabilidad al 100 % y entregas optimizadas»

Aquí está el grueso del trabajo. Se cierra en cuatro frentes:

1. **Exactitud del dato de origen** (L1). Una entrega no falla en la ruta: falla
   cuando se capturó la dirección. En Panamá la dirección postal escrita no es
   fiable — no hay numeración consistente y el código postal apenas se usa. La
   única referencia dura es la **coordenada**. Por eso el mapa no es un lujo de
   interfaz: es el arreglo de raíz.
2. **Un estado por evento, no por suposición** (L2). Cada transición la escribe
   quien la ejecuta —almacén, motorizado, courier externo— y queda con su hora,
   su autor y su ubicación.
3. **Cero fricción para quien entrega** (L2 + L4). El motorizado no escribe
   direcciones: escanea un QR y le abre la navegación. Un toque.
4. **La misma trazabilidad, venga de donde venga** (L5). Que el pedido lo lleve
   un motorizado propio o Servientrega tiene que verse igual en el panel y en la
   página de seguimiento del cliente.

---

## 4. Decisiones que hay que tomar antes de escribir código

Cada una bloquea trabajo concreto. Ninguna la puede tomar el equipo técnico.

| #   | Decisión                                                                                                                | Bloquea               | Por qué hay que decidirla ya                                                    |
| --- | ----------------------------------------------------------------------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------- |
| D1  | **Cuenta de Cloudflare y dominio**                                                                                      | Todo el despliegue    | Sin esto no hay "producción", solo capturas                                     |
| D2  | **Proveedor de mapas**: Google Maps o MapLibre + OpenStreetMap                                                          | Fase L1 completa      | Google exige cuenta de facturación; cambia el costo mensual                     |
| D3  | **Canal de avisos**: solo email, o email + WhatsApp                                                                     | L2 (avisos de estado) | WhatsApp Business API tiene costo por conversación y alta previa en Meta        |
| D4  | **Política de abonos**: ¿mínimo inicial? ¿plazo máximo? ¿se despacha con saldo pendiente o nunca?                       | Fase L3               | Es una regla de negocio, no técnica; define la máquina de estados               |
| D5  | **Modelo con los motorizados**: ¿empleados o independientes? ¿cobran contra entrega? ¿tarifa fija o por zona/distancia? | Fase L4               | Define si hay módulo de liquidaciones y de dinero en manos de terceros          |
| D6  | **Couriers externos**: cuáles, y ¿hay contrato y credenciales de API?                                                   | Fase L5               | Sin credenciales no se puede ni empezar a integrar                              |
| D7  | **Facturación fiscal**: ¿la guía es solo interna o hay factura fiscal electrónica (DGI/FE)?                             | L2 y L3               | Si hay factura fiscal, es un proyecto aparte con su propio proveedor autorizado |

> **Sobre D7.** «Factura» y «guía de despacho» no son lo mismo. Este plan
> construye la **guía de despacho** (documento operativo con QR, ítems y
> dirección). La **factura fiscal electrónica** panameña exige un proveedor
> autorizado por la DGI y se cotiza aparte. Conviene aclararlo con la clienta
> antes de que dé por incluida una cosa dentro de la otra.

---

## 5. Entornos y alojamiento

La pregunta era Cloudflare, Netlify o Supabase. La respuesta ya está decidida y
documentada en [ADR 0002](adr/0002-hosting.md); aquí va el porqué en corto.

### La decisión: **Cloudflare + Supabase. Netlify no hace falta.**

No son alternativas entre sí: Supabase es la base de datos, Cloudflare es donde
corre la aplicación. Netlify sería el sustituto de Cloudflare, y se descartó.

| Pieza                           | Proveedor                     | Qué hace                                         |
| ------------------------------- | ----------------------------- | ------------------------------------------------ |
| Tienda (`storefront`)           | Cloudflare Workers            | Dominio principal                                |
| Panel (`admin`)                 | Cloudflare Workers            | Subdominio propio, cerrado con Cloudflare Access |
| Base de datos y cuentas         | Supabase                      | 34 tablas con RLS, sesiones                      |
| Imágenes de catálogo y CMS      | Cloudflare R2                 | Egress $0                                        |
| Transformaciones de imagen      | Cloudflare Images             | Variantes y recortes                             |
| Video                           | Cloudflare Stream             | Transcodificado y bitrate adaptativo             |
| Fotos de prueba de entrega      | Cloudflare R2, bucket privado | URL firmada, no enlace público                   |
| CDN, WAF, anti-bots, rate limit | Cloudflare                    | Mismo proveedor, una sola configuración          |
| Email transaccional             | Resend                        | Avisos de pedido                                 |

**Por qué Cloudflare y no Netlify:** el ancho de banda es el costo que crece con
el éxito, y Workers no cobra transferencia mientras Netlify cobra por GB pasado
el plan. Una campaña que multiplique el tráfico por diez no mueve la factura de
Cloudflare. Además, WAF y Access —para blindar el panel— vienen del mismo sitio.

**Todo el media va a Cloudflare, no a Supabase Storage.** Es la decisión del
[ADR 0007](adr/0007-media-en-cloudflare.md), tomada a raíz de esta misma
pregunta: había una contradicción sin resolver entre el ADR 0002 (que decía R2)
y `supabase/config.toml` (que declaraba buckets de Supabase Storage). Gana R2,
por el mismo motivo que ganó Workers: la salida de datos no se cobra. Para video
se usa Stream, que transcodifica y adapta la calidad a la conexión — cosa que
Supabase Storage no hace.

**Lo único que se queda en Supabase es la base de datos y las cuentas**, y ahí
sí conviene no moverlo: la seguridad de la plataforma vive en políticas RLS de
Postgres ([ADR 0003](adr/0003-seguridad-en-la-base-de-datos.md)) y el pedido se
crea en una función transaccional de plpgsql
([ADR 0004](adr/0004-pedidos-transaccionales.md)). D1 es SQLite: no tiene ni RLS
ni plpgsql. Mudarse sería reescribir a mano justo lo que la auditoría obligó a
corregir. El razonamiento completo, en el
[ADR 0007](adr/0007-media-en-cloudflare.md).

**Lo que no se acepta a cambio:** el código no usa APIs propietarias de
Cloudflare. Si algún día conviene mudarse, se muda.

### Los tres entornos

| Entorno     | Rama      | Base de datos                   | Para qué                                                        |
| ----------- | --------- | ------------------------------- | --------------------------------------------------------------- |
| Desarrollo  | local     | Supabase en Docker              | Trabajo diario                                                  |
| **Staging** | `develop` | Proyecto Supabase aparte        | Probar antes de producción — **hoy no existe, hay que crearlo** |
| Producción  | `main`    | Proyecto Supabase de producción | La tienda real                                                  |

Que hoy solo haya un entorno es un riesgo abierto: significa probar en
producción. Crear staging es el paso 0.3 del cronograma.

> Nota operativa: en esta sesión el conector de Netlify no logró conectarse
> (error 502 de su servidor). No cambia nada de la recomendación —está tomada
> desde agosto de 2026 y por motivos de costo, no de disponibilidad— pero lo
> dejo dicho por transparencia.

---

## 6. El plan, paso a paso

Seis fases. **Cada una se entrega funcionando y desplegada antes de empezar la
siguiente.** Nada de la fase siguiente arranca si algo de la anterior quedó a
medias — es la misma regla que ya rige el proyecto.

---

### Fase 0 · Poner en el aire lo que ya existe

**Por qué va primero:** hay una plataforma entera construida que la clienta no
puede tocar con las manos. Todo lo demás se construye encima de esto, y probar
en el aire es distinto a probar en local.

> **Corrección de estado, agosto 2026.** La cuenta de Cloudflare ya está
> conectada y **los dos Workers ya existen**: `nebula-storefront` y
> `nebula-admin`, creados el 21 de agosto y actualizados el 22. Lo que falta no
> es la cuenta, es el dominio propio y apuntarlos a una base de datos real en
> vez de al modo demostración.

| Paso | Qué se hace                                                                                                      | Depende de |
| ---- | ---------------------------------------------------------------------------------------------------------------- | ---------- |
| 0.1  | Dominio propio, y los dos Workers apuntados a él                                                                 | **D1**     |
| 0.2  | ~~Habilitar R2~~ (hecho) y **publicar el bucket**: sin dominio público las imágenes se suben pero no se ven      | —          |
| 0.3  | Proyecto Supabase de staging, migraciones aplicadas, historial reconciliado                                      | —          |
| 0.4  | Los Workers dejan el modo demostración y reciben los secretos de Supabase                                        | 0.3        |
| 0.5  | Cloudflare Access sobre el panel                                                                                 | 0.1        |
| 0.6  | Backups automáticos de Supabase con retención definida                                                           | 0.3        |
| 0.7  | ~~Cerrar los pendientes del panel~~ (hecho): menús, subida de imágenes, variantes y datos personales del cliente | 0.2        |
| 0.8  | Páginas legales completadas y revisadas                                                                          | —          |

**Criterio de aceptación:** la clienta abre una URL desde su teléfono, navega la
tienda, entra al panel con su usuario y ve un pedido de prueba de punta a punta.

**Duración estimada:** 1–2 semanas. La mitad es esperar decisiones y accesos, no
programar.

---

### Fase L1 · La dirección deja de ser texto y pasa a ser un punto en el mapa

**El problema real.** Hoy el checkout pide calle, ciudad y provincia en cajas de
texto (`apps/storefront/src/components/checkout-form.tsx`). El cliente escribe
«casa blanca portón negro cerca del super», y el motorizado llama por teléfono.
Cada llamada es tiempo, y cada dirección mal escrita es una entrega fallida que
se paga dos veces.

**La solución.** Exactamente el patrón de PedidosYa, Uber e inDriver:

1. Al llegar al paso de dirección, el mapa se abre centrado en la ubicación del
   navegador (con permiso; si lo niega, en el centro de la ciudad).
2. Un buscador con autocompletado sugiere direcciones mientras escribe.
3. Un **pin arrastrable** fija el punto exacto. Es la fuente de verdad.
4. Debajo, dos campos de texto: **referencia** («portón negro, al lado de la
   farmacia») e **instrucciones de entrega** («llamar al llegar»).
5. La dirección queda guardada y reutilizable desde `/cuenta/direcciones`.

**Lo que se toca:**

- Migración: `addresses` y el `shipping_address` de `orders` ganan `latitude`,
  `longitude`, `location_precision` (`gps` \| `pin` \| `geocoded` \| `manual`),
  `reference`, `delivery_instructions` y `plus_code`.
- Componente nuevo `<SelectorDeDireccion>` en `packages/ui`, usado tanto en el
  checkout como en el panel de cliente.
- El panel administrativo muestra el punto en un mini-mapa dentro del pedido y
  de la ficha de cliente.
- **Zonas de cobertura**: tabla `delivery_zones` con polígonos. Si el pin cae
  fuera, el checkout lo dice antes de cobrar, no después.

**Detalle que conviene decidir bien (D2):**

| Opción                       | A favor                                                                             | En contra                                                                                                                            |
| ---------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **Google Maps Platform**     | La mejor cobertura de lugares en Panamá; el autocompletado es notablemente superior | Exige cuenta de facturación; hay capa gratuita mensual pero conviene **confirmar tarifas vigentes antes de comprometer presupuesto** |
| **MapLibre + OpenStreetMap** | Sin costo, sin dependencia de facturación                                           | El autocompletado de direcciones es más pobre fuera del centro urbano                                                                |

**Recomendación:** Google para el autocompletado, y el pin arrastrable como red
de seguridad — así, aun cuando la búsqueda falle, el punto exacto siempre se
puede fijar a mano. El componente se escribe con el proveedor detrás de una
interfaz, para poder cambiarlo sin tocar el checkout.

> **Confirmado por la API del courier, no solo por criterio propio.** La guía de
> Servientrega Panamá acepta campos `latitud` y `longitud`
> ([investigación](INVESTIGACION-COURIERS-PANAMA.md)). Es decir: el courier
> nacional **consume coordenadas**, no solo los motorizados propios. Sin esta
> fase se le entregaría una guía peor de lo que su propia API admite. Y el
> destino se indica por **provincia y distrito en texto, sin código postal**, tal
> y como Servientrega los escribe — así que además hay que mantener esa lista de
> nombres, porque uno que no coincida es una guía rechazada.

**Criterio de aceptación:** un pedido nuevo llega al panel con coordenadas, y
abrirlas en el móvil cae sobre la puerta correcta.

**Duración estimada:** 2 semanas.

---

### Fase L2 · Trazabilidad completa: guía, QR, estados y seguimiento público

**Lo que ya hay:** la bitácora `order_events` registra sola cada cambio de
estado y de pago, con autor y fecha. La media base está puesta.

**Lo que falta:**

#### 2.a · Envíos como entidad propia

Tabla nueva `shipments`: un pedido puede tener uno o varios envíos (porque un
pedido con abonos puede despacharse parcial, y porque un pedido grande puede ir
en dos viajes).

Cada envío guarda: número de guía propio, transportista (motorizado propio o
courier externo), estado, fecha estimada, fecha real, coordenada de entrega,
prueba de entrega y costo.

Estados: `pendiente` → `asignado` → `recogido` → `en_ruta` → `entregado`, con
`fallido` y `devuelto` como salidas. Se declaran en una máquina de estados como
la que ya existe en `packages/domain/src/order-state.ts`, para que ningún
proceso pueda saltarse un paso.

#### 2.b · La guía de despacho, con el QR

Un PDF generado por el sistema, imprimible en térmica 4×6" y también legible en
pantalla. Lleva:

- Número de guía y número de pedido
- Cliente, teléfono y dirección escrita
- **Referencia e instrucciones de entrega** (lo que capturó L1)
- Ítems y cantidades
- **Saldo pendiente por cobrar**, bien visible, si el pedido va con abonos (L3)
- **El código QR**

#### 2.c · El QR y por qué no apunta directo a un mapa

El QR **no** codifica una coordenada cruda. Codifica una URL corta y firmada:
`https://tudominio.com/g/<token>`.

Al escanearla, el motorizado ve una página mínima con:

- **Botón «Abrir en Waze»** → `https://waze.com/ul?ll=<lat>,<lng>&navigate=yes`
- **Botón «Abrir en Google Maps»** → `https://www.google.com/maps/dir/?api=1&destination=<lat>,<lng>`
- Teléfono del cliente en un toque
- Referencia e instrucciones
- Botón para marcar entregado o fallido

**Por qué la vuelta.** Un QR con un `geo:` crudo abre lo que decida el sistema
operativo, y en muchos teléfonos no abre nada. Con la página intermedia el
motorizado **elige** su app, y de paso la página sirve para registrar el
escaneo, actualizar el estado y capturar la prueba de entrega. El QR pasa de ser
una etiqueta a ser la herramienta de trabajo.

Si el pedido va por un courier externo, la misma página muestra además el
enlace de rastreo del transportista.

#### 2.d · Seguimiento público para el cliente

Página `/seguimiento/<token>` —mismo mecanismo de token opaco que ya usa la
confirmación de pedido— con:

- Línea de tiempo con cada estado, su hora y quién lo hizo
- Mapa con el punto de entrega y, cuando el motorizado esté en ruta, su
  posición aproximada
- Datos del motorizado asignado: nombre, foto y teléfono
- Saldo pendiente, si lo hay

Accesible desde el email, desde `/cuenta/pedidos` y por enlace directo.

#### 2.e · Avisos automáticos

Los tres emails que ya existen se amplían a los estados de envío: _pedido
despachado_, _el motorizado va en camino_, _entregado_. Si se decide WhatsApp
(**D3**), el mismo disparador manda por los dos canales.

**Criterio de aceptación:** un pedido de prueba recorre los cinco estados; la
clienta lo sigue desde su teléfono sin llamar a nadie; el QR impreso abre Waze
en dos toques.

**Duración estimada:** 3 semanas.

---

### Fase L3 · Abonos: cobrar por partes y despachar cuando cuadre

**Lo que ya aguanta la base de datos:** la tabla `payments` ya permite varios
pagos por pedido, y el proveedor `manual` ya existe en el catálogo de métodos —
justo el que hace falta para registrar un abono en efectivo o por transferencia.

**Lo que falta:**

#### 3.a · El pedido sabe cuánto lleva pagado

- `orders` gana `amount_paid` y `balance_due`, mantenidos por la base de datos
  —no por la aplicación— para que nunca se desincronicen.
- El estado de pago gana `partially_paid`, y la máquina de estados de
  `packages/domain` se amplía: `pending` → `partially_paid` → `paid`.
- Tabla `payment_plans`: monto inicial, número de cuotas, vencimientos.

#### 3.b · Registrar abonos desde el panel

En el detalle del pedido, un bloque **«Abonos»**: registrar pago (monto, método,
fecha, referencia, comprobante adjunto), historial de abonos y saldo. Cada abono
queda en la bitácora con su autor.

#### 3.c · La regla que decide si se despacha

Aquí manda **D4**. Se implementa como ajuste configurable, no como código
quemado:

- **Estricta:** no se despacha hasta saldo cero.
- **Con umbral:** se despacha al alcanzar un % del total (por ejemplo, 50 %).
- **Contra entrega:** se despacha con saldo, y quien entrega cobra el resto — lo
  que enlaza directo con la liquidación de la Fase L4. **Y no solo con
  motorizados propios:** la guía de Servientrega Panamá tiene un campo
  `valor_recaudar`, así que el courier nacional también puede cobrar el saldo
  pendiente en la puerta.

Sea cual sea, **el panel no deja marcar «despachado» si la regla no se cumple**,
igual que hoy no deja saltarse un estado de pedido.

#### 3.d · El cliente ve su saldo

En `/cuenta/pedidos` y en la página de seguimiento: cuánto abonó, cuánto debe y
cuándo vence lo siguiente. Recordatorios automáticos por email antes del
vencimiento.

**Criterio de aceptación:** un pedido de $300 recibe tres abonos de $100 desde el
panel; al tercero, el pedido se vuelve despachable solo; el cliente vio su saldo
bajar en cada paso.

**Duración estimada:** 2 semanas.

---

### Fase L4 · La comunidad de motorizados dentro de la plataforma

Es la fase más grande y la que más valor propio aporta: es el activo de la
clienta, y ningún courier externo se lo replica.

#### 4.a · Quiénes son dentro del sistema

- Nuevo rol `courier` en el catálogo de roles que ya existe (`user_role`).
- Tabla `couriers`: nombre, teléfono, foto, cédula, tipo y placa de vehículo,
  zonas que cubre, tarifa acordada, estado (activo / inactivo / en pausa),
  documentos (licencia, seguro) con su fecha de vencimiento.
- Las políticas RLS se amplían: **un motorizado ve exactamente los envíos que
  tiene asignados, y nada más.** Ni el catálogo, ni los otros pedidos, ni los
  clientes. Esto se prueba con tests contra base de datos real, como ya se
  prueba el resto de la seguridad.

#### 4.b · La app del motorizado

Una PWA —se instala desde el navegador, sin tienda de aplicaciones, sin esperar
aprobaciones—, ruta `/motorizado` dentro de la tienda. Cinco pantallas:

1. **Mis entregas de hoy**, ordenadas por ruta
2. **Detalle del envío**: dirección, referencia, mapa, botones de Waze y Google
   Maps, teléfono del cliente
3. **Escáner de QR**, para tomar un envío desde la guía impresa
4. **Cerrar entrega**: foto de la prueba, firma en pantalla, monto cobrado si
   corresponde, o motivo del fallo
5. **Mi día**: entregas hechas, kilómetros, dinero recaudado, lo que se le debe

Pensada para móvil, con una mano, y **tolerante a mala señal**: si no hay
conexión al cerrar una entrega, se guarda en el teléfono y se sincroniza sola al
recuperarla. Esto no es opcional en reparto urbano.

#### 4.c · Asignación y rutas, en el panel

- Pantalla **Despacho**: envíos pendientes a la izquierda, motorizados
  disponibles a la derecha, mapa en el centro.
- Asignación manual (arrastrar) y **sugerencia automática** por zona, carga
  actual y cercanía.
- **Optimización de ruta**: dado un motorizado con N entregas, propone el orden
  que menos kilómetros recorre. Empieza simple —vecino más cercano sobre las
  coordenadas de L1, que ya es mejor que el criterio humano— y se sustituye por
  un servicio de optimización real si el volumen lo justifica.
- Mapa en vivo de motorizados en ruta.

#### 4.d · Liquidaciones

Solo si **D5** dice que los motorizados cobran contra entrega o trabajan por
tarifa variable:

- Tabla `courier_settlements`: por periodo, entregas hechas, tarifas devengadas,
  efectivo recaudado, saldo a favor o en contra.
- Pantalla de cierre con exportación, y vista del motorizado en su propia app.

**Criterio de aceptación:** un motorizado real instala la PWA, recibe tres
entregas asignadas, navega a cada una desde el QR, cierra con foto y firma, y su
día cuadra en el panel sin que nadie toque una hoja de cálculo.

**Duración estimada:** 4–5 semanas. Es la fase más grande, y conviene partirla:
primero rol + app básica + asignación manual (L4.1), después rutas y
liquidaciones (L4.2).

---

### Fase L5 · Couriers externos: Servientrega, Droppy y los que vengan

**El principio:** exactamente el mismo patrón que ya se usó con las pasarelas de
pago. Una interfaz común, un adaptador por proveedor, y el resto del sistema sin
enterarse de cuál está activo.

`packages/integrations/src/shipping/` con un contrato de cuatro operaciones:

| Operación   | Qué hace                                                      |
| ----------- | ------------------------------------------------------------- |
| `cotizar`   | Precio y plazo para un destino y un peso                      |
| `crearGuia` | Genera la guía en el sistema del courier y devuelve su número |
| `rastrear`  | Consulta el estado actual                                     |
| `webhook`   | Recibe los cambios de estado que el courier empuja            |

Cada estado del courier se traduce al vocabulario propio de `shipments`, para
que la línea de tiempo que ve el cliente sea idéntica venga de donde venga.

**Cómo se decide quién lleva cada pedido:** el motorizado propio para la zona
cubierta; el courier externo para el resto del país. Configurable por zona desde
el panel.

> **Investigación hecha.** Qué proveedor tiene API, cuál no, y por dónde
> conviene empezar, en
> [`INVESTIGACION-COURIERS-PANAMA.md`](INVESTIGACION-COURIERS-PANAMA.md). El
> resumen: **Dropi PA primero** —un adaptador da cuatro couriers panameños y el
> pago contra entrega—, y **Servientrega Panamá en paralelo**, que resultó ser la
> mejor documentada después de DHL: hay sandbox, y una librería PHP con licencia
> MIT que deja el contrato completo a la vista. Solo Shippea sigue sin API
> conocida.
>
> Esa investigación **desbloquea la estimación de esta fase**: para Servientrega
> Panamá ya no hay descubrimiento pendiente, solo portar unas 200 líneas a
> TypeScript.

**Aviso honesto sobre las credenciales.** Las APIs de estos proveedores
regionales no siempre están documentadas públicamente y a veces exigen contrato
firmado antes de dar acceso a sandbox. **Hasta no tener credenciales y
documentación en la mano no se puede estimar esta fase con seriedad.** Lo que sí
se puede hacer desde ya —y se hará en L2— es dejar el hueco preparado: un campo
de número de guía y un enlace de rastreo manual cubren el caso "lo mandamos por
Servientrega y pegamos el número a mano" sin ninguna integración.

**Duración estimada:** 1–2 semanas por proveedor, **una vez haya credenciales**.

---

## 7. Resumen del modelo de datos nuevo

Sobre las 34 tablas actuales, se añaden:

| Tabla                                         | Fase | Para qué                                   |
| --------------------------------------------- | ---- | ------------------------------------------ |
| _(columnas nuevas en `addresses` y `orders`)_ | L1   | Coordenadas, referencia, instrucciones     |
| `delivery_zones`                              | L1   | Polígonos de cobertura y tarifa por zona   |
| `shipments`                                   | L2   | Envíos, con guía y estado propios          |
| `shipment_events`                             | L2   | Línea de tiempo de cada envío              |
| _(columnas nuevas en `orders`)_               | L3   | `amount_paid`, `balance_due`               |
| `payment_plans`                               | L3   | Plan de abonos y vencimientos              |
| `couriers`                                    | L4   | Ficha del motorizado                       |
| `courier_assignments`                         | L4   | Qué envío lleva quién, y cuándo            |
| `delivery_proofs`                             | L4   | Foto, firma, coordenada y hora de entrega  |
| `courier_settlements`                         | L4   | Liquidación por periodo                    |
| `carrier_accounts`                            | L5   | Credenciales y config de couriers externos |

Todas con RLS desde la primera migración. **La regla del proyecto es que ninguna
tabla se crea sin su política ni sin su test**, y el CI la hace cumplir: hay un
paso que falla si aparece una tabla sin RLS.

---

## 8. Costo mensual añadido

Sobre la base actual (~$25–30/mes en la escala de lanzamiento, según
[`COSTOS.md`](COSTOS.md)):

| Servicio                                          | Cuándo                      | Costo estimado                                                                             |
| ------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------ |
| Google Maps Platform                              | L1, si se elige (D2)        | Hay capa gratuita mensual; **confirmar tarifas vigentes antes de comprometer presupuesto** |
| MapLibre + OpenStreetMap                          | L1, alternativa             | $0                                                                                         |
| WhatsApp Business API                             | L2, si se elige (D3)        | Costo por conversación; depende del volumen                                                |
| Generación de PDF y QR                            | L2                          | $0 — se genera en el propio Worker                                                         |
| Cloudflare R2 (imágenes, PDF, pruebas de entrega) | 0.2 y L4                    | 10 GB-mes gratis; después $0,015/GB-mes, con salida de datos a $0                          |
| Cloudflare Stream                                 | Si se sube video            | Se cobra por minuto almacenado y entregado; confirmar tarifa según el volumen previsto     |
| Optimización de rutas                             | L4.2, si el volumen lo pide | $0 con el algoritmo propio; de pago solo si se sustituye                                   |
| Couriers externos                                 | L5                          | Lo que cobre cada uno por envío, no por integración                                        |

**Lo importante:** ninguna de estas piezas tiene costo fijo alto. Todas escalan
con el uso, y las dos que sí cobran (mapas y WhatsApp) tienen alternativa gratuita
o son opcionales.

---

## 9. Cronograma

| Fase                                      | Semanas           | Acumulado |
| ----------------------------------------- | ----------------- | --------- |
| 0 · Despliegue y pendientes del panel     | 1–2               | 2         |
| L1 · Direcciones con mapa                 | 2                 | 4         |
| L2 · Trazabilidad, guía y QR              | 3                 | 7         |
| L3 · Abonos                               | 2                 | 9         |
| L4.1 · Motorizados: rol, app y asignación | 3                 | 12        |
| L4.2 · Rutas y liquidaciones              | 2                 | 14        |
| L5 · Couriers externos                    | 1–2 por proveedor | 15–16     |

**Del orden.** No es arbitrario. L1 va antes que todo lo demás porque **sin
coordenadas no hay QR que valga, ni ruta que optimizar, ni entrega que
verificar.** La exactitud del dato de origen es el cimiento; construir la app
del motorizado sobre direcciones escritas a mano sería levantar la casa sin
zapata.

**Qué se puede enseñar y cuándo.** Al terminar cada fase hay algo funcionando
en el aire que la clienta puede tocar. No hay que esperar a la semana 16 para
ver resultados: en la semana 4 ya pone su dirección en un mapa, y en la 7 ya
sigue un pedido desde su teléfono.

---

## 10. Riesgos

| Riesgo                                                   | Impacto                  | Qué lo contiene                                                                       |
| -------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------- |
| Las decisiones de la §4 se demoran                       | Todo el cronograma corre | Ninguna necesita más de una conversación; conviene cerrarlas de una vez               |
| Los couriers externos no dan API o exigen contrato antes | L5 se atasca             | El campo de guía manual (L2) cubre el caso mientras tanto                             |
| Los motorizados no adoptan la app                        | L4 no rinde              | PWA sin instalación desde tienda, una sola pantalla por entrega, y funciona sin señal |
| El costo de mapas sorprende al escalar                   | Factura inesperada       | Proveedor detrás de una interfaz: se cambia a OpenStreetMap sin tocar el checkout     |
| Se confunde guía de despacho con factura fiscal          | Expectativa incumplida   | Aclarado en **D7** antes de empezar                                                   |
| Dinero en efectivo en manos de terceros                  | Descuadres               | Liquidación con cierre por periodo y prueba de entrega obligatoria (L4.4)             |
| Sin entorno de staging                                   | Se prueba en producción  | Paso 0.2, antes de cualquier fase nueva                                               |

---

## 11. Lo que hace falta de la clienta, en concreto

Para arrancar mañana:

1. **Cuenta de Cloudflare** (o autorización para crearla) y **el dominio**.
2. Respuesta a **D2** (mapas), **D3** (WhatsApp) y **D4** (política de abonos).
3. Respuesta a **D5**: cómo trabaja hoy con sus motorizados. Cuanto más
   concreto —cuántos son, cómo cobran, qué zonas cubren, cómo se enteran hoy de
   una entrega— mejor sale la Fase L4.
4. Si ya tiene contrato con algún courier, **las credenciales de su API**.
5. Aclarar **D7**: si necesita factura fiscal electrónica, hay que cotizarla
   aparte.

Con 1 y 2 se arranca. El resto se puede ir cerrando sobre la marcha, cada una
antes de que empiece su fase.
