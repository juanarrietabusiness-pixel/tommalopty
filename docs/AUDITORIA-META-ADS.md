# Auditoría — Publicitar productos en Meta Ads desde el panel

**Pregunta auditada:** ¿puede la dueña seleccionar productos del catálogo,
pulsar «Publicitar» en el panel, poner un presupuesto y que eso cree anuncios
reales en Meta Business?

**Alcance:** exclusivamente ese punto. No se auditan pagos, CMS, CRM ni el resto
de la plataforma salvo donde bloquean esta funcionalidad.

**Fecha:** agosto 2026 · **Rama:** `claude/meta-ads-integration-analysis-5lvoot`

---

## 1. Veredicto

**No es ficción: es técnicamente real y hay precedentes en producción**
(Shopify, WooCommerce y BigCommerce hacen exactamente esto con sus apps de
Facebook e Instagram). La Marketing API de Meta permite crear campañas,
conjuntos de anuncios con presupuesto, creativos y anuncios por HTTP.

**Pero en esta plataforma hoy no existe ni una línea de ese código.** Lo que hay
es Pixel + Conversions API, que es **medición**, no gestión de publicidad: envía
señales *hacia* Meta y nunca lee ni escribe nada en una cuenta publicitaria.

Traducido: **la infraestructura para publicitar hay que construirla entera.** No
está «pensado para eso y estamos bien». Está pensado para *medir*, que es la
mitad previa y necesaria, y esa mitad está a medio terminar (ver §6).

Y hay una frontera que conviene entender antes de prometer nada al cliente: **el
dinero nunca pasa por la plataforma.** El panel puede fijar el número del
presupuesto; el cobro lo hace Meta contra la tarjeta que la dueña registre en su
propia cuenta publicitaria.

---

## 2. Lo que pediste, traducido a piezas técnicas

| Lo que pediste | Pieza técnica real | ¿Existe? |
| --- | --- | --- |
| «que se conecte un API a la web» | Marketing API (Graph API) de Meta | 🔲 No |
| «seleccionar productos del catálogo» | Catálogo de Meta + feed de productos | 🔲 No |
| «darle publicitar en el panel» | UI de anuncios en `apps/admin` | 🔲 No |
| «que se vaya a anuncios» | Modelo de datos campaña/anuncio | 🔲 No |
| «conectar ese presupuesto» | `daily_budget` / `lifetime_budget` del ad set | 🔲 No |
| «al Meta Business» | Business Manager + cuenta publicitaria + token | 🔲 No |
| (implícito) medir el resultado | Pixel + Conversions API | 🟡 Parcial |

---

## 3. Qué existe hoy — con evidencia

Todo lo que hay de Meta en el repo:

| Archivo | Qué hace |
| --- | --- |
| `packages/integrations/src/meta/conversions-api.ts` | `POST` a `graph.facebook.com/<version>/<pixelId>/events` |
| `packages/integrations/src/meta/events.ts` | Catálogo de nombres de evento y `event_id` compartido |
| `packages/integrations/src/meta/hash.ts` | Normalización + SHA-256 de datos personales |
| `apps/storefront/src/components/meta-pixel.tsx` | Pixel de navegador (`fbq`) |
| `apps/storefront/src/lib/tracking.ts` | Envío de eventos servidor con IP, UA y cookies `_fbp`/`_fbc` |
| `apps/admin/src/app/configuracion/page.tsx` | Interruptor de activación de `meta_pixel` |

Está bien hecho para lo que es: hashea la PII antes de salir, usa Web Crypto
para correr igual en Node/Workers/Edge, nunca lanza excepción (el marketing no
tumba un checkout) y versiona la Graph API por variable de entorno. Esa parte no
tengo nada que objetarle.

**El único endpoint de Meta que la plataforma toca es `/events`.** Ese endpoint
recibe conversiones. No crea anuncios, no lee presupuestos, no conoce cuentas
publicitarias.

## 4. Qué no existe

Verificado por búsqueda exhaustiva en todo el repositorio:

- ❌ Ninguna llamada a `/act_<id>/campaigns`, `/adsets`, `/ads`, `/adcreatives`
- ❌ Ningún flujo OAuth con Meta (`Facebook Login for Business`)
- ❌ Ningún almacenamiento de tokens de usuario o de System User
- ❌ Ninguna tabla de cuentas publicitarias, campañas de anuncios o gasto
- ❌ Ningún feed de catálogo (`/feed.xml`, `/api/catalogo`) en `apps/storefront/src/app/api/`
- ❌ Ninguna sección «Anuncios» o «Publicidad» en la navegación del panel
  (`apps/admin/src/lib/nav.tsx`)
- ❌ Ninguna variable de entorno de Marketing API en `.env.example`
  (solo `NEXT_PUBLIC_META_PIXEL_ID`, `META_CONVERSIONS_ACCESS_TOKEN`, `META_TEST_EVENT_CODE`)

**Aviso sobre la tabla `campaigns`:** existe (`supabase/migrations/20260819090300_customers_crm.sql`)
y el ROADMAP la lista como pendiente de interfaz, pero es de **campañas de
email**: `channel text not null default 'email'`, con `subject`, `body` y
`segment`. No sirve para anuncios y reutilizarla sería un error de modelado. Que
el ROADMAP diga «Campañas» no significa que haya nada empezado de Meta Ads.

---

## 5. ¿Qué permite Meta realmente? Las cuatro fronteras duras

### 5.1 Sí se puede: crear y gestionar anuncios por API

La Marketing API expone la jerarquía completa. Un «publicitar este producto» se
traduce en cuatro llamadas encadenadas:

1. `POST /act_<ad_account_id>/campaigns` → objetivo (`OUTCOME_SALES`), estado
2. `POST /act_<ad_account_id>/adsets` → **presupuesto** (`daily_budget` en
   centavos), segmentación, ubicaciones, calendario, `promoted_object`
3. `POST /act_<ad_account_id>/adcreatives` → imagen/vídeo, texto, enlace
4. `POST /act_<ad_account_id>/ads` → une conjunto + creativo

Pausar, reanudar y cambiar el presupuesto son `POST` sobre esos mismos objetos.
El gasto y los resultados se leen con `GET /<id>/insights`. Todo esto es
estándar y estable desde hace años.

### 5.2 No se puede: cobrar el presupuesto desde la plataforma

**Esta es la expectativa que hay que corregir antes de vender la función.**

La API permite *fijar* el presupuesto de un conjunto de anuncios. No permite
*cobrarlo*. El medio de pago se registra en Ads Manager / Business Manager de la
dueña, y Meta le factura directamente a ella. La plataforma puede leer el estado
de facturación de la cuenta, pero dar de alta una tarjeta es un flujo de la
interfaz de Meta, no de la API.

Consecuencia práctica: el panel puede decir «presupuesto: 20 $/día» y Meta
cobrará esos 20 $/día a la tarjeta de la dueña. Lo que el panel **no** puede
hacer es que la dueña pague la publicidad *a través* de la plataforma.

### 5.3 No se puede: publicar sin revisión de Meta

Cada anuncio pasa por revisión automatizada (de minutos a 24 h) y puede ser
rechazado por política. La UI tiene que mostrar `PENDING_REVIEW`, `ACTIVE`,
`DISAPPROVED` y el motivo. Un botón «Publicitar» que prometa publicación
inmediata miente.

### 5.4 Condicionado: el nivel de acceso a la API

Aquí está la buena noticia de este proyecto, y depende de un detalle de
arquitectura que verifiqué en el esquema: **no hay ninguna columna de tenant,
`store_id` ni `organization_id` en ninguna migración.** Esta plataforma es
**mono-tienda**: un despliegue, una tienda, una dueña.

Eso cambia radicalmente la dificultad:

| Escenario | Qué hace falta | Plazo |
| --- | --- | --- |
| **Mono-tienda (el actual)** — la dueña gestiona *su propia* cuenta | App de Meta en el Business Manager de ella + **System User token** (no caduca) con `ads_management`, `business_management`, `catalog_management`. La app puede quedarse sin publicar: gestiona activos propios. **Sin App Review.** | días |
| **SaaS multi-tienda (si algún día se vende a terceros)** | App en modo Live + Facebook Login for Business + **App Review** de `ads_management` + **Verificación de Negocio** + nivel de acceso de la Marketing API + posible registro como Tech Provider | semanas, y puede ser rechazado |

Sobre el segundo escenario, Meta cambió las reglas el **4 de mayo de 2026**: lo
que se llamaba *Standard/Advanced Access* pasó a llamarse **Marketing API Access
Tier**, con dos niveles — *Limited Access* (Business Manager verificado + app
publicada con Marketing API activada) y *Full Access* (≥ 500 llamadas en 15 días
con menos del 15 % de error). Si el proyecto se convierte en SaaS, esto hay que
releerlo en la fuente antes de planificar.

**Recomendación:** construir para el escenario mono-tienda. Es el que
corresponde al esquema actual, no necesita App Review y se puede tener
funcionando sin depender de la aprobación de Meta.

### 5.5 Condicionado: sin catálogo no hay «publicitar este producto»

«Seleccionar productos del catálogo y publicitarlos» exige un **Catálogo de
Meta** sincronizado. Dos vías:

- **Feed programado** — la tienda publica una URL (CSV/TSV/XML) y Meta la lee
  cada X horas. Es lo más simple y robusto.
- **Catalog Batch API** — se empuja cada cambio. Más inmediato, más código.

Campos obligatorios: `id`, `title`, `description`, `availability`, `condition`,
`price` **con código de moneda** (`19.99 USD`), `link`, `image_link`; y al menos
uno de `brand`, `mpn` o `gtin` para poder anunciarse. Imágenes JPG/PNG de
**500×500 px mínimo**.

Y el requisito que rompe integraciones a los seis meses: **el `id` del feed tiene
que coincidir exactamente con el `content_ids` que envían el Pixel y la
Conversions API.** Aquí es donde el código actual tiene un problema real (§6.2).

---

## 6. Hallazgos en el código actual

Todos verificados leyendo el código. Los tres primeros hay que arreglarlos sí o
sí antes de tocar publicidad, porque el catálogo de Meta no emparejará.

### 6.1 🔴 `ViewContent` no se dispara nunca

`META_EVENTS` declara `viewContent`, `search` y `addPaymentInfo`
(`packages/integrations/src/meta/events.ts`), pero **ninguno de los tres se emite
en ninguna parte de la aplicación**. La ficha de producto
(`apps/storefront/src/app/producto/[slug]/page.tsx`) no envía `ViewContent`.

Los anuncios de catálogo (Advantage+ Catalog Ads, antes «anuncios dinámicos»)
**exigen** los tres eventos estándar `ViewContent`, `AddToCart` y `Purchase`. Sin
`ViewContent` no hay retargeting de producto visto, que es justamente el caso de
uso más rentable para una tienda pequeña.

### 6.2 🔴 Los `content_ids` son inconsistentes y a veces imposibles de emparejar

Dos emisores, dos criterios distintos:

- `apps/storefront/src/components/product-purchase-panel.tsx:52` →
  `content_ids: [variant.sku ?? variant.id]`
- `apps/storefront/src/app/checkout/confirmacion/[token]/page.tsx:63` →
  `id: item.sku ?? item.id`

En el segundo caso `item` es una fila de `order_items`, así que **`item.id` es el
identificador de la línea del pedido**, no del producto ni de la variante. Es un
UUID distinto en cada compra.

Efecto: una variante sin SKU reporta en `AddToCart` el id de la variante y en
`Purchase` un UUID aleatorio. Ninguno de los dos coincidirá con el `id` del feed,
y Meta no podrá atribuir la venta al producto anunciado. El síntoma clásico es
«los anuncios dinámicos no convierten» meses después, sin causa aparente.

**Arreglo:** definir un identificador canónico de producto (recomiendo
`variant.id`, que es estable y siempre existe, o el SKU si se hace obligatorio) y
usar *el mismo* en el feed, en el Pixel y en la CAPI. Un solo helper compartido.

### 6.3 🟡 Ningún evento se envía por los dos canales — la deduplicación nunca se ejercita

El README y `docs/ARQUITECTURA.md` describen Pixel + CAPI con `event_id`
compartido para que Meta deduplique. En el código, cada evento va por un solo
canal:

| Evento | Pixel (cliente) | CAPI (servidor) |
| --- | --- | --- |
| `PageView` | ✅ | ❌ |
| `AddToCart` | ✅ | ❌ |
| `InitiateCheckout` | ❌ | ✅ |
| `Purchase` | ❌ | ✅ |
| `Lead` | ❌ | ✅ |

La infraestructura de deduplicación está construida y es correcta, pero **no hay
un solo evento que la use**. `AddToCart` va solo por navegador (lo pierden los
bloqueadores, que es exactamente lo que la CAPI venía a resolver) y `Purchase`
va solo por servidor. No es un fallo grave, pero la documentación promete algo
que el código no hace todavía.

### 6.4 🟡 Faltan campos de producto que el feed exige

- `product_variants.barcode` existe en el esquema pero **el formulario del panel
  no lo expone** (`apps/admin/src/components/product-form.tsx`): no hay forma de
  cargar el GTIN desde la interfaz.
- No existe `condition` (`new`/`used`/`refurbished`), obligatorio en el feed.
- No existe categoría de producto de Google/Meta, que mejora mucho la entrega.
- `brand` sí existe, y con eso se cumple el mínimo de «brand, mpn o gtin».

### 6.5 🟡 No hay subida de imágenes — y sin imágenes no hay catálogo

`docs/ROADMAP.md` lo lista como pendiente: «Subida de imágenes a R2 /
Supabase Storage desde el panel». `apps/storefront/next.config.ts` tiene
`remotePatterns: []` y el seed no carga ninguna imagen de producto.

`image_link` es obligatorio en el feed de Meta, con mínimo 500×500 px. **La
subida de imágenes es prerrequisito duro de esta funcionalidad**, no un extra.

### 6.6 🟡 La arquitectura de credenciales no admite OAuth por comercio

Decisión actual, explícita en `docs/DESPLIEGUE.md` y en la propia pantalla de
integraciones: «las claves viven en variables de entorno del hosting, nunca en
la base de datos». La tabla `integrations` solo guarda el interruptor y
configuración no sensible.

Para el escenario mono-tienda esto **funciona sin cambios**: un System User token
no caduca y cabe perfectamente en `wrangler secret put`. Para un futuro
multi-tienda habría que añadir almacenamiento cifrado de tokens y renovación —
un cambio de arquitectura, no un añadido.

### 6.7 🟡 No hay tareas programadas configuradas

`apps/storefront/wrangler.jsonc` no declara `triggers.crons`, y `pg_cron` está
documentado pero comentado en `supabase/migrations/20260820170000_caducidad_de_reservas.sql`.
Sincronizar gasto y resultados de los anuncios necesita una tarea periódica.
Cloudflare Cron Triggers lo resuelve, pero hoy no hay ninguna montada.

### 6.8 🔴 Secuencia: no hay pasarela de pago, luego no hay conversiones reales

Las cuatro pasarelas lanzan `NotImplementedError` a propósito
([ADR 0006](adr/0006-pasarela-al-final.md)). Sin cobros no hay eventos
`Purchase` reales, y sin `Purchase` reales el algoritmo de Meta no tiene nada que
optimizar: una campaña de conversiones sin señal de conversión gasta el
presupuesto casi a ciegas y necesita ~50 conversiones semanales por conjunto para
salir de la fase de aprendizaje.

**Publicitar antes de poder cobrar es quemar dinero.** El orden correcto es
pasarela → conversiones reales → catálogo → anuncios.

---

## 7. Lo que hay que construir

Estimación para el escenario mono-tienda, una persona desarrollando, sin contar
la latencia de Meta (verificación del negocio, revisión de anuncios).

| # | Fase | Contenido | Días |
| --- | --- | --- | --- |
| 0 | **Arreglos de medición** | `ViewContent`, id canónico compartido, doble canal en `AddToCart`/`Purchase` | 2–3 |
| 1 | **Campos y medios** | `barcode`/GTIN y `condition` en el formulario; subida de imágenes a R2 *(ya pendiente en el ROADMAP)* | 5–8 |
| 2 | **Feed de catálogo** | Ruta pública XML/CSV con los campos obligatorios, paginada y cacheada | 3–4 |
| 3 | **Conexión con Meta** | Variables de entorno, System User token, ad account / página / catálogo, prueba de conexión en Integraciones | 2–3 |
| 4 | **Modelo de datos** | Tablas `meta_ad_campaigns` / `meta_ads` (producto → ids de Meta, presupuesto, estado, gasto) + RLS | 1–2 |
| 5 | **Servicio Marketing API** | Crear campaña/conjunto/creativo/anuncio, pausar, reanudar, cambiar presupuesto, manejo de errores y reintentos | 5–8 |
| 6 | **UI del panel** | Botón «Publicitar» en catálogo + sección «Anuncios» con presupuesto, estado de revisión y resultados | 4–6 |
| 7 | **Sincronía de resultados** | Cron de `insights`, gasto e integración con Reportes | 3–4 |
| | **Total** | | **25–38 días** ≈ **5–8 semanas** |

Más, por fuera del desarrollo: verificación del negocio de la dueña en Meta,
creación del Business Manager y la cuenta publicitaria, alta del medio de pago y
revisión de las páginas legales de la tienda (Meta las revisa igual que las
pasarelas).

---

## 8. Recomendación honesta

**Sí, se puede. Pero yo no construiría un clon de Ads Manager dentro del panel.**

Razones concretas:

1. **La API se mueve.** Meta retira versiones de la Graph API con regularidad;
   cada versión obliga a revisar el código. Una tienda de una sola dueña
   heredaría un mantenimiento permanente.
2. **Ads Manager siempre será mejor UI.** Segmentación, públicos similares,
   pruebas A/B, Advantage+ — replicar eso son meses, y la versión propia será
   siempre peor y más vieja.
3. **El 80 % del valor está en el catálogo, no en el botón.** Con el catálogo
   sincronizado y los eventos bien puestos, la dueña ya puede lanzar anuncios
   dinámicos de sus productos desde Ads Manager en cinco minutos. El botón
   «Publicitar» ahorra clics, no habilita nada nuevo.

**Orden que propongo:**

- **Ahora (fases 0–2, ~10–15 días):** arreglar los eventos y publicar el feed de
  catálogo. Es trabajo con valor propio, sin depender de aprobaciones de Meta, y
  es prerrequisito de todo lo demás. Con esto la dueña ya puede anunciar.
- **Después de la pasarela (fases 3–6):** un «Publicitar» **fino** — un solo tipo
  de campaña sensata (ventas por catálogo, presupuesto diario, público amplio),
  no un configurador completo. Cubre el caso «quiero empujar estos cinco
  productos» sin heredar la superficie entera de la Marketing API.
- **Fase 7 al final:** traer el gasto y los resultados al panel para que la
  dueña vea rentabilidad junto a sus ventas. Ahí sí el panel aporta algo que Ads
  Manager no da: coste del anuncio contra margen real del producto.

**Lo que no hay que prometer al cliente:** que la plataforma cobra o gestiona el
presupuesto (lo cobra Meta), que los anuncios salen al instante (hay revisión),
ni que esto existe hoy en alguna forma parcial (no existe).

---

## 9. Límites de esta auditoría

- El código se revisó en su totalidad para este punto; las afirmaciones sobre lo
  que existe y lo que no están verificadas archivo por archivo.
- **`developers.facebook.com` y `developers.meta.com` están bloqueados por el
  proxy de red de esta sesión**, así que los detalles de la API (niveles de
  acceso, especificación del feed, permisos) provienen de resultados de búsqueda
  y de conocimiento previo, no de la documentación oficial leída directamente.
  Antes de planificar en firme conviene confirmar en la fuente: los niveles de
  acceso de la Marketing API, la especificación vigente del feed de catálogo y
  la versión actual de la Graph API.
- No se ejecutó ninguna llamada real contra la API de Meta: no hay credenciales
  en este entorno.
