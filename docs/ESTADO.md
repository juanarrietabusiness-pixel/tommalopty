# Estado de la plataforma

> **Última actualización:** 3 de septiembre de 2026 (migración de la bóveda
> **aplicada** en staging y tipos generados de verdad; antes: panel de
> integraciones, eventos de Meta, importación de productos y auditoría de interfaz).
> Este documento es el punto de entrada para quien retome el trabajo. Dice qué
> hay publicado, qué está roto, qué se sabe de cada fallo abierto y qué se
> aprendió por las malas. El plan de a dónde vamos está en
> [`PLAN-LOGISTICA.md`](PLAN-LOGISTICA.md); esto es de dónde partimos.

> **¿Acabas de recibir este proyecto?** Empieza por [`SIGUIENTE.md`](SIGUIENTE.md),
> que dice en veinte minutos qué hay, qué puedes tocar hoy y qué está esperando a
> otra cosa.

> **¿Tienes acceso a Supabase y a Cloudflare?** Lo tuyo es
> [`CONECTAR.md`](CONECTAR.md), que lleva la lista ordenada con su verificación.
> **Los pasos 1 a 5 y la migración de la bóveda (paso 9.b) ya están hechos**
> —migraciones aplicadas, advisors revisados, bucket privado creado, `anon`
> revocado y, desde el 3 de septiembre, la tabla `integration_credentials` creada
> y verificada—. Lo que queda de esa lista cuelga casi todo de **comprar el
> dominio**, más dos cosas: para que la bóveda funcione de verdad falta **poner la
> variable `CREDENCIALES_CLAVE_MAESTRA` y volver a publicar** (una persona), y
> **CI puede seguir avisando de una única línea, `PostgrestVersion`**, ahora que
> los tipos se regeneraron de verdad. Puntos 9b y 21 de la lista de pendientes.

---

## 1. Dónde está publicado, y cómo se publica

| Entorno        | Tienda                                                      | Panel                                                  | Base de datos                                          |
| -------------- | ----------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------ |
| **Staging**    | `https://nebula-storefront.juanarrietabusiness.workers.dev` | `https://nebula-admin.juanarrietabusiness.workers.dev` | Supabase `tommalopty-staging` (`pdbeqkxhrqicgfhcanwl`) |
| **Producción** | no existe todavía                                           | no existe todavía                                      | —                                                      |

**Staging escribe en una base de datos real.** Lo que se edite ahí se guarda.
No es una demostración.

Se publica a mano desde **Actions → «Publicar en staging» → Run workflow**. El
campo `rama` acepta cualquier rama; sin él usa la de por defecto. No hay
despliegue automático al empujar código, y es deliberado: publicar es una
decisión, no un efecto secundario.

Configuración necesaria, ya puesta (Settings → Secrets and variables → Actions):

| Tipo     | Nombre                                              | Para qué                                     |
| -------- | --------------------------------------------------- | -------------------------------------------- |
| Secret   | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`     | Desplegar los Workers                        |
| Secret   | `STAGING_SUPABASE_SERVICE_ROLE_KEY`                 | Confirmar pedidos (salta RLS; solo servidor) |
| Variable | `STAGING_SUPABASE_URL`, `STAGING_SUPABASE_ANON_KEY` | Conexión pública a Supabase                  |
| Variable | `STAGING_SITE_URL`, `STAGING_ADMIN_URL`             | Que cada aplicación sepa su propia URL       |
| Variable | `R2_PUBLIC_URL`                                     | Dominio público de las imágenes              |
| Secret   | `STAGING_RESEND_API_KEY`                            | Correo transaccional. **Aún sin poner**      |
| Variable | `STAGING_EMAIL_FROM`, `STAGING_EMAIL_REPLY_TO`      | Remitente del correo. **Aún sin poner**      |

La anon key va como **variable y no como secreto** a propósito: viaja en el
navegador de cualquiera que abra la tienda. Lo que protege los datos es RLS, no
el secreto de esa clave.

Las tres del correo **todavía no están puestas, y no es un olvido**: `EMAIL_FROM`
necesita un dominio verificado en Resend, y el dominio es el P1 número 2. El
despliegue ya sabe leerlas y cargarlas en el Worker; mientras falten, lo dice en
su resumen y la tienda funciona igual, solo que sin avisar a nadie. Los pasos de
instalación, cuando haya dominio, están en
[`PLAN-LOGISTICA.md` § 2.e](PLAN-LOGISTICA.md).

### Quién tiene acceso a qué, y qué NO es una vía de acceso

Este apartado existe porque la pregunta se ha hecho ya y se volverá a hacer, y
porque la respuesta equivocada cuesta cara: **ninguna parte de esta plataforma
depende de una conexión MCP.**

> Lo pendiente de accesos y credenciales, con sus casillas, está en el
> [issue #23](https://github.com/juanarrietabusiness-pixel/tommalopty/issues/23).
> Este apartado explica el porqué; ese issue lleva la cuenta de lo que falta.

#### Un conector MCP no es una credencial de la tienda

Quien desarrolla puede tener conectados a su asistente conectores de Supabase,
Cloudflare, Notion, Resend o los que sea. Eso son **cuentas personales de esa
persona**, atadas a su sesión de trabajo, y no tienen nada que ver con la
plataforma:

- **El código no lee ningún conector.** Todo lo que la tienda necesita lo lee de
  variables de entorno (`process.env`), y esas variables las pone el despliegue
  desde los secretos del repositorio. No hay un solo `import` de nada MCP.
- **Una sesión de asistente no tiene acceso a la base de datos ni a Cloudflare de
  este proyecto**, salvo que alguien le dé las credenciales a propósito. Las
  sesiones de trabajo de este repositorio no las han tenido.
- Por eso, cuando en un commit se lee «probado contra Postgres real», eso
  significa **una base de datos desechable levantada dentro del contenedor de esa
  sesión**, con el esquema del repositorio aplicado y datos inventados. Nunca es
  staging, y nunca es producción.

Si alguien alguna vez conecta un MCP a la base real, **eso no es integrarlo: es
darle acceso de escritura a una persona.** Se decide a sabiendas y se revoca al
terminar.

#### La regla de trabajo, dicha por el dueño del proyecto

**Ninguna sesión de desarrollo usa los conectores personales de quien programa
para este proyecto.** Ni Supabase, ni Cloudflare, ni Resend, ni ningún otro: son
cuentas de una persona, y esta plataforma es de otra. Lo que haga falta conectar
se escribe en un issue y en este documento, y lo ejecuta quien tenga las
credenciales del negocio.

La única excepción, y conviene que esté dicha: **el conector de GitHub**, porque
es la única vía para abrir issues y pull requests en este repositorio desde una
sesión sin `gh` instalado, y está limitado a `juanarrietabusiness-pixel/tommalopty`.
Nada de lo que hace toca la tienda, la base de datos ni el hosting.

#### Cómo se autentica de verdad cada servicio

| Servicio                   | Para qué                                    | Cómo entra la credencial                                                                                             | Estado hoy                                                    |
| -------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| **Supabase**               | Base de datos, autenticación, RLS           | `NEXT_PUBLIC_SUPABASE_URL` + anon key (variables) y `SUPABASE_SERVICE_ROLE_KEY` (secreto)                            | ✅ Puesto (staging)                                           |
| **Cloudflare Workers**     | Servir las dos aplicaciones                 | `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` (secretos de Actions)                                               | ✅ Puesto                                                     |
| **Cloudflare R2**          | Imágenes de producto                        | Enlace `r2_buckets` en `wrangler.jsonc` + `R2_PUBLIC_URL`                                                            | ✅ Puesto, bucket `nebula-media`                              |
| **Cloudflare R2 privado**  | Prueba de entrega y comprobante de abono    | Enlace `r2_buckets` (`MEDIA_PRIVADA`). **Sin dominio público, y no debe tenerlo**                                    | ✅ Creado, `nebula-media-privada`                             |
| **Resend**                 | Correo transaccional                        | `RESEND_API_KEY` (secreto) + `EMAIL_FROM`                                                                            | 🔲 Falta. Necesita dominio                                    |
| **Meta**                   | Píxel y Conversions API                     | `NEXT_PUBLIC_META_PIXEL_ID` + `META_CONVERSIONS_ACCESS_TOKEN`                                                        | 🔲 Falta                                                      |
| **Yappy · Botón**          | Cobrar en el checkout                       | `YAPPY_MERCHANT_ID`, `YAPPY_SECRET_KEY`, `YAPPY_DOMAIN_URL`                                                          | 🔲 Falta especificación y credenciales                        |
| **Yappy · Integración**    | Conciliar cobros                            | `YAPPY_API_URL`, `YAPPY_API_KEY`, `YAPPY_API_SECRET_KEY`                                                             | 🔲 Falta el host de la API                                    |
| **Teselas del mapa**       | Las imágenes del mapa                       | `NEXT_PUBLIC_MAP_TILES_URL`                                                                                          | ⚠️ CARTO sin clave, sin plan                                  |
| **Bóveda de credenciales** | Que la dueña pegue sus claves sin desplegar | `CREDENCIALES_CLAVE_MAESTRA` (secreto). **La única variable que hace falta para que las demás dejen de hacer falta** | ⚠️ Migración aplicada (3 sep); falta la variable y republicar |

Los nombres exactos y sus valores de ejemplo están en
[`.env.example`](../.env.example). Las reglas de qué va como secreto y qué como
variable, en [`DESPLIEGUE.md`](DESPLIEGUE.md). **Y el orden en el que conviene
enchufar todo esto, con su verificación paso a paso, en
[`CONECTAR.md`](CONECTAR.md).**

#### Lo que ninguna sesión de trabajo puede hacer sola

Conviene tenerlo presente al leer un commit que dice «listo»:

- **Aplicar migraciones.** El workflow de «Publicar en staging» construye y
  despliega los Workers; **no toca la base de datos**. Las migraciones se aplican
  a mano con `supabase db push` desde una máquina que sí tenga acceso al
  proyecto. Contra staging **nunca** `supabase db reset`: eso borra, y staging
  guarda datos reales.
- **Poner un secreto.** Los valores los pega una persona en GitHub → Settings →
  Secrets and variables → Actions. Nada de este repositorio los contiene ni
  puede leerlos.
- **Verificar contra Supabase de verdad.** Lo más cerca que llega una sesión sin
  acceso es un Postgres con el esquema aplicado. Quien confirma que las
  migraciones entran limpias en un Supabase real es **CI**, que levanta uno con
  Docker en cada pull request.

**Salvo que alguien le dé los accesos a propósito**, que es lo que pasó el 1 de
septiembre: una sesión con los conectores de Supabase y Cloudflare puestos aplicó
las migraciones pendientes y ejecutó `CONECTAR.md`. Eso no cambia la regla —el
código sigue sin depender de ningún MCP, y sigue leyendo solo `process.env`—;
cambia quién ejecutó ese paso. Se decide a sabiendas y se revoca al terminar.

#### Cuando la plataforma pase a la dueña

Las cuentas de servicio son de quien las crea. Si se abren a nombre de quien
desarrolla, el día del traspaso el correo, el dominio o las imágenes se quedan
atrás. Antes de abrir al público, cada una de estas debería estar a nombre del
negocio:

| Cuenta         | Qué se pierde si queda a nombre de otra persona                    |
| -------------- | ------------------------------------------------------------------ |
| **Supabase**   | La base de datos entera y sus backups                              |
| **Cloudflare** | El dominio, los Workers y las imágenes de R2                       |
| **Resend**     | El dominio verificado del correo, y con él todos los avisos        |
| **Yappy**      | El comercio afiliado y su liquidación bancaria                     |
| **Meta**       | El píxel y el histórico de conversiones que alimenta la publicidad |

Lo que **no** hay que traspasar es este repositorio de configuración: no guarda
ninguna credencial, a propósito.

### Cómo entra el primer administrador

No hay pantalla para crearlo, y hace bien: si la hubiera, se la quedaría quien
llegase antes que la dueña. Hay una lista de correos invitados en
`public.admin_bootstrap` que nacen con rol de equipo al registrarse. Cada fila
sirve una vez y caduca a la semana. La tabla no tiene **ningún** privilegio
concedido —ni `anon`, ni `authenticated`, ni `service_role`—: solo la lee el
disparador de alta. Ver migración `20260901020000`.

---

## 2. Qué funciona hoy en staging

- Tienda pública completa: catálogo, búsqueda, ficha de producto, carrito,
  checkout con cotización en servidor, confirmación de pedido.
- Panel de cliente: pedidos, direcciones, favoritos, datos personales.
- Panel administrativo: dashboard, pedidos, CRM, descuentos, productos con
  variantes e imágenes, inventario, CMS (banners, páginas, menús), reportes,
  usuarios y roles, zonas de reparto.
- **Fase L1 completa**: la dirección del checkout captura coordenada,
  procedencia del punto, referencia e instrucciones de entrega, y todo eso viaja
  hasta quedar grabado en el pedido.
- **El punto del mapa rellena la dirección**: marcado el punto —con el pin, con
  el buscador o con el GPS— se resuelve qué dirección hay ahí y se vuelca en
  dirección, ciudad y provincia. Lo que se escriba a mano manda: ese campo deja
  de tocarse. Dos tests end-to-end lo vigilan, comprobados en rojo sin el
  arreglo.
- **Fase L3 casi completa**: se cobran abonos desde el panel, el saldo lo lleva
  la base de datos, y una regla configurable decide si un pedido con saldo puede
  salir del almacén. Falta solo los recordatorios por correo.
- **Fase L2 casi completa**: los envíos son una entidad propia con su máquina de
  estados, el panel los crea y los mueve, la guía se imprime en 4×6" con su QR,
  la página que abre ese QR funciona en la calle, y quien compró sigue su pedido
  sin registrarse. Falta solo 2.e, los avisos automáticos por correo, y falta
  por el dominio: ver el punto 1.
- **Fase L4.1 completa**: los motorizados tienen rol propio, ficha, zonas y
  permisos comprobados contra Postgres real. El panel los da de alta y les asigna
  envíos; ellos entran en `/motorizado` desde la tienda y ven **solo** lo que
  llevan encima.
- **Fase L4.2 casi completa**: la pantalla de **Despacho** propone a quién darle
  cada envío —con el motivo de cada candidato— y en qué orden conviene hacer las
  entregas de cada motorizado, con los kilómetros que ahorra. Falta el mapa de
  esa pantalla, la posición en vivo, y las liquidaciones, que están bloqueadas
  por **D5**: una decisión de negocio sobre cómo se paga a los motorizados.
- **Las credenciales se pegan, no se despliegan**: hay una bóveda cifrada
  (AES-256-GCM) y una pantalla de Integraciones donde la dueña mete las claves de
  Yappy, Meta o Resend sin llamar a nadie. **Falta aplicar su migración y poner
  una variable**; mientras tanto todo sigue leyendo el entorno igual que antes.
- **El panel de integraciones ya no crece hacia abajo**: filas plegadas agrupadas
  por para qué sirven, y cada una dice qué la está bloqueando.
- **Importar productos desde una hoja de cálculo** (`/catalogo/importar`): sube o
  pega el fichero, **ve qué se entendió** —qué columna es cada campo, cómo quedó
  cada precio, qué filas se descartan— y confirma. Sirve tanto para el inventario
  propio en Excel como para lo que exporta una extensión tipo «DS Amazon Quick
  View Extended»: los encabezados no tienen que llamarse de ninguna forma.
- **El panel se puede usar desde un teléfono.** Cuatro pantallas se salían de la
  pantalla a lo ancho, y los campos provocaban zoom automático en iPhone. Las dos
  cosas tienen ahora su test de regresión.
- **Meta mide lo que hay que medir**: se añadieron `ViewContent` —de donde sale el
  público de «miró y no compró»—, `Search` y el `Purchase` del lado navegador. El
  identificador del píxel se puede cambiar desde el panel, sin desplegar.
- **Ficheros privados**: la foto de la prueba de entrega y el comprobante de un
  abono van a un bucket **sin dominio público**. Lo que se guarda en la base es
  la clave del objeto, que por sí sola no sirve de nada: para ver el fichero hay
  que pedir el envío o el pago por una ruta que comprueba permisos. **Falta crear
  el bucket en Cloudflare** — el código ya está y avisa si no lo encuentra.

### Mapa de la plataforma: cada pantalla y su dirección

Todo lo de abajo está publicado en staging y se puede abrir hoy. La tienda
cuelga de `https://nebula-storefront.juanarrietabusiness.workers.dev` y el
panel de `https://nebula-admin.juanarrietabusiness.workers.dev`.

**Panel administrativo** (`nebula-admin`, entra `operator`, `admin` o `superadmin`):

| Pantalla         | Ruta                                 | Qué hace                                                                   |
| ---------------- | ------------------------------------ | -------------------------------------------------------------------------- |
| Entrar           | `/entrar`                            | Acceso del equipo. Un motorizado **no** entra aquí                         |
| Resumen          | `/`                                  | Ventas del día, pedidos por estado, lo que hay que atender                 |
| Pedidos          | `/pedidos`                           | Listado, filtros, detalle, abonos y envíos                                 |
| Guía de envío    | `/pedidos/[id]/guia/[shipmentId]`    | La etiqueta 4×6" con su QR, lista para imprimir                            |
| **Despacho**     | `/despacho`                          | **L4.2.** A quién darle cada envío, con el motivo, y en qué orden repartir |
| **Motorizados**  | `/motorizados`                       | **L4.1.** Alta, zonas, documentos y estado de cada uno                     |
| Clientes (CRM)   | `/clientes`, `/clientes/[id]`        | Ficha, histórico y notas                                                   |
| Catálogo         | `/catalogo`                          | Productos, variantes, imágenes                                             |
| Inventario       | `/catalogo/inventario`               | Existencias y ajustes                                                      |
| Descuentos       | `/descuentos`                        | Códigos y reglas                                                           |
| Contenido        | `/contenido/{banners,paginas,menus}` | El CMS de la tienda                                                        |
| Reportes         | `/reportes`                          | Ventas, productos, clientes                                                |
| Usuarios y roles | `/usuarios`                          | Quién es qué                                                               |
| Zonas de reparto | `/configuracion/zonas`               | Las zonas que usa la cotización **y la sugerencia de despacho**            |

**Tienda y clientes** (`nebula-storefront`):

| Pantalla                   | Ruta                             | Qué hace                                                           |
| -------------------------- | -------------------------------- | ------------------------------------------------------------------ |
| Tienda                     | `/`, `/tienda`, `/buscar`        | Catálogo, búsqueda, categorías                                     |
| Producto                   | `/producto/[slug]`               | Ficha con variantes                                                |
| Carrito y checkout         | `/carrito`, `/checkout`          | **El mapa que rellena la dirección sola vive aquí**                |
| Confirmación               | `/checkout/confirmacion/[token]` | Lo que ve quien acaba de comprar                                   |
| **Seguimiento del pedido** | `/seguimiento/[token]`           | **L2.** Línea de tiempo del envío, **sin registrarse**             |
| **Lo que abre el QR**      | `/g/[token]`                     | **L2.** La página que se abre desde la guía, pensada para la calle |
| Panel del cliente          | `/cuenta`                        | Pedidos, direcciones, favoritos, datos                             |

**Equipo de motorizados** (`nebula-storefront`, entra el rol `courier`):

| Pantalla     | Ruta               | Qué hace                                                            |
| ------------ | ------------------ | ------------------------------------------------------------------- |
| Mis entregas | `/motorizado`      | **L4.1.** Solo lo que lleva encima. No ve el resto de la operación  |
| Una entrega  | `/motorizado/[id]` | Dirección, mapa, teléfono, y cerrarla con foto de prueba de entrega |

Un motorizado entra por la **tienda**, no por el panel: `/entrar` de
`nebula-storefront`. El panel lo rechaza a propósito — su lista de roles
permitidos es `operator`, `admin` y `superadmin`, y `courier` no está.

### Cómo probar la fase L2 sin datos propios

Hay un pedido de prueba en staging con dos envíos, uno entregado y otro en
camino:

| Qué                     | Dónde                                                           |
| ----------------------- | --------------------------------------------------------------- |
| Seguimiento del cliente | `/seguimiento/<confirmation_token del pedido>`                  |
| Lo que abre el QR       | `/g/<token del envío>`                                          |
| La guía imprimible      | Panel → Pedidos → el pedido → Envíos → «Ver e imprimir la guía» |

Los tokens salen de la base: `select order_number, confirmation_token from
orders` y `select tracking_number, token from shipments`.

Lo que **no** funciona: ver el punto 3.

---

## 3. Lo que falta, por orden de urgencia

Ordenado por lo que cuesta si no se hace, no por lo que cuesta hacerlo. Los
cuatro primeros bloquean la apertura; el resto se puede hacer con la tienda ya
funcionando.

### 🔴 P1 · Impide abrir al público

| #     | Qué falta                                            | Por qué es crítico                                                                                                                                    | Quién puede hacerlo                            |
| ----- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| ~~1~~ | ~~**El mapa del checkout no muestra las imágenes**~~ | **Resuelto.** El mapa se previsualiza, y desde hoy además rellena la dirección sola. Queda un matiz de proveedor: ver 3.1                             | —                                              |
| 2     | **Dominio propio** y los dos Workers apuntados a él  | Hoy las URL son `workers.dev`. No se puede dar a clientes reales, ni cobrar, ni pasar la revisión de una pasarela                                     | La dueña (comprar el dominio) + desarrollo     |
| 3     | **Páginas legales** completadas y revisadas          | Términos, privacidad, envíos y devoluciones son plantillas. Sin ellas no se puede vender legalmente en Panamá, y ninguna pasarela aprueba el comercio | La dueña + alguien que conozca la ley panameña |
| 4     | **Proveedor de teselas del mapa con plan**           | Hoy se usa CARTO sin clave. Su cuota razonable no cubre una tienda en producción                                                                      | Decisión de la dueña (coste) + desarrollo      |

### 🟠 P2 · Se puede abrir sin ello, pero duele pronto

| #     | Qué falta                                                                                                                                                                                                                                                                                                                                                                                               | Qué pasa si no está                                                                                                                                                                                                                                                                       |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5     | **Los avisos automáticos por correo** (L2 2.e y L3): despachado, en camino, entregado, recordatorio de vencimiento                                                                                                                                                                                                                                                                                      | El cliente llama por teléfono para preguntar dónde está su pedido. Es el trabajo manual que la plataforma existía para quitar                                                                                                                                                             |
| 6     | **Cloudflare Access sobre el panel**                                                                                                                                                                                                                                                                                                                                                                    | El panel administrativo es alcanzable por cualquiera que sepa la URL. RLS protege los datos, pero la pantalla de acceso queda expuesta a fuerza bruta                                                                                                                                     |
| 7     | **Backups de Supabase con retención definida**                                                                                                                                                                                                                                                                                                                                                          | Un borrado accidental no tiene vuelta atrás                                                                                                                                                                                                                                               |
| ~~8~~ | ~~**Crear el bucket privado en Cloudflare**~~ **Hecho.** `nebula-media-privada` existe y el binding `MEDIA_PRIVADA` ya lo alcanza. Falta la comprobación de punta a punta: subir una prueba de entrega y confirmar que su enlace da 403 sin sesión ([`CONECTAR.md`](CONECTAR.md) § 4)                                                                                                                   |
| 9b    | ~~**Aplicar la migración de la bóveda**~~ **Hecho (3 sep).** `integration_credentials` existe en staging, con RLS activo sin políticas, `anon`/`authenticated` revocados y verificado que un rol de usuario no la lee. **Falta solo poner `CREDENCIALES_CLAVE_MAESTRA` (secreto) y volver a publicar** — eso es de una persona. Mientras tanto el panel avisa y todo sigue leyendo variables de entorno |
| 9     | **Pasarela de pago real conectada**                                                                                                                                                                                                                                                                                                                                                                     | Hoy los pedidos se registran pero no se cobran en línea. Los abonos manuales sí funcionan. De Yappy falta **solo el Botón de Pago**, y falta porque falta su especificación: ver [`YAPPY.md`](YAPPY.md). Es una decisión de negocio pendiente ([ADR 0006](adr/0006-pasarela-al-final.md)) |

### 🟡 P3 · Deuda conocida, sin urgencia

| #   | Qué                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 10  | **La URL pública de R2 sigue en `r2.dev`**: hay que pasarla a dominio propio antes de producción                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 11  | **`http://localhost:3000/**` falta en las Redirect URLs de Supabase**: sin eso, registrarse desde el entorno de desarrollo no confirma cuentas                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 12  | **La posición del motorizado en ruta**: la aplicación y la pantalla de despacho ya existen; falta que el teléfono envíe la posición y una columna donde guardarla. Es lo único de L4.2 que pide migración ([#29](https://github.com/juanarrietabusiness-pixel/tommalopty/issues/29))                                                                                                                                                                                                                                                                                                                                                                               |
| 13  | **`/cuenta/direcciones` es solo lectura**: no se pueden guardar ni reutilizar direcciones con su punto                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 14  | **La cabecera de la tienda se esconde con `:has()`** en la página del motorizado, en vez de mover las rutas a un grupo con su propio layout. Atajo consciente; se borra cuando alguien haga esa reorganización                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 15  | **La pantalla de integraciones lee `NEXT_PUBLIC_META_PIXEL_ID` de forma dinámica**, así que dirá «pendiente» aunque esté configurada. Cosmético, afecta a una fila                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 16  | **`NEXT_PUBLIC_ADMIN_URL` no lo lee nadie**: se declara en `.env.example` y el despliegue lo pasa, pero ningún código lo usa. O se usa, o se quita: una variable que se configura y no hace nada es media hora de alguien buscando por qué                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 17  | **Las cuentas de servicio deberían estar a nombre del negocio** antes de abrir. Ver el apartado «Cuando la plataforma pase a la dueña» del punto 1                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 18  | **_Leaked Password Protection_ está desactivado en Supabase**: comprueba las contraseñas nuevas contra HaveIBeenPwned. Es un interruptor en Authentication → Policies, sin coste y sin cambios de código                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 19  | **La prueba de punta a punta del bucket privado sigue sin hacerse**: subir una foto de entrega y confirmar que su enlace da 403 en una ventana sin sesión. El bucket ya existe; lo que falta es alguien con el panel abierto                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 20  | **El mapa de la pantalla de Despacho**: se dejó fuera a propósito, y va detrás del plan de teselas (P1 número 4). Un mapa abierto toda la jornada consume más cuota que decenas de checkouts ([#30](https://github.com/juanarrietabusiness-pixel/tommalopty/issues/30))                                                                                                                                                                                                                                                                                                                                                                                            |
| 20b | **La auditoría de interfaz dejó dos cosas sin cerrar**: no se ha medido el contraste más allá de lo que comprueba axe, ni el rendimiento percibido (LCP, CLS) sobre una conexión lenta. Ninguna de las dos es un fallo conocido; son medidas que no se han tomado                                                                                                                                                                                                                                                                                                                                                                                                  |
| 21  | ~~**Los tipos generados difieren del esquema en CI**~~ **Resuelto en código (3 sep).** El fichero commiteado era una reescritura a mano; se regeneró de verdad desde staging (= las 33 migraciones) y se pasó por el mismo Prettier que usa CI. Afloraron y se corrigieron discrepancias reales que el formato a mano ocultaba (nulabilidad de `create_order`, el helper `Views`). **Solo puede quedar una línea, `PostgrestVersion`**, que depende de la versión de la base que genera los tipos; si el diff de CI queda en esa línea, es un cierre trivial y confirma que no hay deriva ([#5](https://github.com/juanarrietabusiness-pixel/tommalopty/issues/5)) |

---

## 3.1 · El mapa: lo que se resolvió y lo que queda

**Resuelto: el recuadro salía vacío.** Lo causaba una colisión de CSS. MapLibre
le pone al contenedor su clase `.maplibregl-map`, que trae `position: relative`
y anulaba el `inset: 0` del que dependía el alto: el mapa se construía entero
—lienzo, controles, atribución— dentro de una caja de cero píxeles. Se arregló
con mayor especificidad más alto y ancho explícitos, y hay un test end-to-end
que **falla sin el arreglo**. Confirmado: el mapa se previsualiza.

**Resuelto: marcar el punto no rellenaba nada.** La coordenada se capturaba y
llegaba al pedido, así que nada parecía roto — pero quien marcaba su casa en el
mapa tenía que escribir después la misma dirección a mano, que era justo el
trabajo que el mapa venía a quitarle. Ahora el punto resuelve su dirección
(`/api/geo/inverso`, Nominatim por el servidor y cacheado) y la vuelca en los
tres campos. Detalles que importan y ya están decididos:

- La dirección sale **siempre del punto final**, nunca del resultado de búsqueda
  que llevó hasta él. El pin es la verdad. Usar las dos fuentes daba textos que
  cambiaban solos al asentarse el mapa.
- **Lo escrito a mano manda.** En cuanto alguien toca un campo, ese campo es
  suyo y ningún movimiento posterior del pin lo vuelve a tocar.
- El reparto de la respuesta de OpenStreetMap a los tres campos es puro y está
  en `packages/domain/src/direccion.ts`. La jerarquía panameña —provincia,
  distrito, corregimiento— no cae siempre en las mismas claves de OSM, así que
  **cuando una dirección real salga mal repartida, el arreglo empieza por pegar
  su respuesta en `direccion.test.ts`.**

**Lo que queda, y es de la dueña, no de programación:** el proveedor de teselas
(P1 número 4). Hoy es CARTO sin clave, y su cuota razonable no cubre una tienda
abierta.

**Un dato que ahorra media tarde a quien depure esto:** hay entornos que
bloquean `basemaps.cartocdn.com` por política de red —el sandbox de desarrollo
de este proyecto lo hace, y algunos bloqueadores de rastreo también—. El síntoma
es idéntico al fallo de CSS ya resuelto: recuadro vacío. Se distinguen en la
pestaña **Network**: si las peticiones a `cartocdn` no salen o vuelven con 403,
es la red, no el código, y el componente lo dice con su propio mensaje («no
pudimos cargar las imágenes del mapa»).

## 4. Lo que se aprendió por las malas

Cuatro fallos de esta tanda comparten forma y volverán a aparecer si no se
tienen presentes.

### `??` no protege de una cadena vacía

`process.env.X ?? 'valor'` solo salta con `undefined`. Una variable sin definir
en GitHub Actions llega como **cadena vacía**, pasa el `??`, y `new URL('')`
revienta. Tumbó la compilación entera de la tienda. Hay ayudantes en
`apps/*/src/lib/site.ts` que validan de verdad; usarlos.

### `NEXT_PUBLIC_*` hay que escribirlo literal

Next sustituye en compilación `process.env.NEXT_PUBLIC_ALGO` **escrito así,
literal**. Una lectura por nombre —`readEnv('NEXT_PUBLIC_ALGO')`— no la
reconoce y queda como lectura en tiempo de ejecución. En el Worker esas
variables no existen, porque son de compilación. El síntoma fue desconcertante:
`isSupabaseConfigured()` decía que sí y la línea siguiente lanzaba «falta la
variable de entorno».

### `authenticated` no es sinónimo de «cliente»

Quien administra la tienda también es `authenticated`. Revocar una columna de
ese rol se la quita igual a la dueña del negocio. Los permisos por columna no
distinguen; lo que distingue es `is_staff()`, y eso vive en las políticas.

Esto rompió dos veces: el catálogo público estuvo once días ilegible, y el panel
respondía «server error» nada más entrar. Si algún día hace falta esconder de
verdad un dato de operación de un cliente con sesión, la vía es una vista
`security_invoker = off` con `where public.is_staff()`.

Hay red de seguridad: `packages/db/src/__tests__/permisos.test.ts` ejecuta contra
Postgres real cada consulta que las aplicaciones hacen, con el rol que la hará.
**Cuando se añada una pantalla que lea algo nuevo, se añade ahí su consulta.**

### `grant ... on all tables` solo alcanza a lo que ya existe

Una tabla creada después nace sin privilegios de los nuestros. Está declarado
`alter default privileges` para `authenticated` y `service_role`, que sí alcanza
al futuro.

**Y lo que decía aquí sobre `anon` era falso.** Decía que se dejaba fuera a
propósito, y que por tanto una tabla nueva no quedaba expuesta al público. No es
así: **el arranque de Supabase declara sus propios `alter default privileges`
concediendo a `anon`**, y los suyos también aplican. Toda tabla creada en
`public` nace con `select, insert, update, delete` **y `truncate`** para el
público, digamos aquí lo que digamos.

Se descubrió en CI, con un test que esperaba «permission denied» sobre
`shipments` y recibió cero filas: contra un Postgres pelado el permiso no
existía; contra el Supabase de verdad, sí.

Con RLS bien puesta, las cuatro primeras no devuelven ni tocan nada. **`truncate`
es la excepción y la que importa**: no está sujeto a políticas de fila, así que
el privilegio es lo único que separa a un anónimo de vaciar una tabla. Hoy no se
llega a él desde la API REST —PostgREST no lo expone— pero eso es una propiedad
de la capa de arriba, no de la base.

**Y hay un matiz que solo se ve mirando la base.** Los privilegios por omisión
vienen de dos sitios distintos, y no dan lo mismo: `pg_default_acl` tiene una
entrada por cada rol que crea tablas. La de `supabase_admin` concede a `anon` los
siete privilegios; la de `postgres` —que es quien ejecuta las migraciones— solo
concedía `TRUNCATE`, `REFERENCES`, `TRIGGER` y `MAINTAIN`. Por eso el mismo
esquema daba resultados distintos en CI y en staging, y por eso el issue describía
más privilegios de los que `shipments` tenía aquí. **El que importaba estaba en
los dos: `truncate`.**

**Resuelto** en la migración 0033, y con las tres cosas hechas y no solo la
primera:

1. `anon` se revocó tabla por tabla —nunca con un bucle— dejando `select` solo en
   las trece que la tienda lee de verdad, e `insert` solo en `leads`.
2. `alter default privileges in schema public revoke all on tables from anon`,
   para que las futuras nazcan limpias. Comprobado creando una tabla de verdad:
   nace sin nada.
3. `permisos.test.ts` pasó de comprobar solo lo que `anon` **sí** puede a
   comprobar también lo que **no**: 36 aserciones nuevas, verificadas contra
   staging antes de escribirlas.

**La conclusión práctica sigue en pie:** una tabla nueva se revoca a `anon`
explícitamente en su propia migración, en vez de confiar en que no se le
concedió. Los `alter default privileges` de `supabase_admin` no se pueden cambiar
desde una migración, así que el paso 2 protege pero no es una garantía; el test
del paso 3 sí lo es.

### Un dato de prueba con forma de credencial bloquea el push

Un test de cifrado usaba `sk_live_51H8x…` como secreto de ejemplo. Es inventado y
no abre nada, pero tiene **exactamente la forma de una clave de Stripe**, y la
protección de secretos de GitHub rechazó el push entero.

Hizo bien. Un escáner que solo bloqueara las claves que de verdad funcionan
tendría que probarlas, y para entonces ya estarían publicadas: lo único que puede
mirar es la forma.

La conclusión es de una línea: **los valores de ejemplo no se parecen a
credenciales reales.** `valor-de-prueba-largo-que-no-es-de-ningun-proveedor` prueba
lo mismo y no dispara nada. Y el susto que provoca —«¿alguien metió una clave de
verdad?»— cuesta más que el rato de escribir una cadena aburrida.

### Un test que no puede fallar no prueba nada

El primer test del mapa pasaba en verde con el CSS roto, porque en desarrollo el
orden de carga de las hojas es el favorable y el fallo solo aparece en el
paquete de producción. **Comprobar siempre que el test falla sin el arreglo.**

---

## 5. Por dónde seguir

**Las siete preguntas de la clienta, hoy:**

| Pregunta                                       | Estado                                                   |
| ---------------------------------------------- | -------------------------------------------------------- |
| ¿Podrá seguir sus pedidos?                     | ✅ Con línea de tiempo, y sin registrarse                |
| ¿La dirección se marca en un mapa?             | ✅ Se ve, se marca, y el punto rellena la dirección solo |
| ¿La guía lleva QR que abra Waze y Maps?        | ✅ Guía imprimible en 4×6" con su QR                     |
| ¿Puede recibir abonos y despachar al cuadrar?  | ✅ Con tres reglas de despacho a elegir                  |
| ¿Hay panel de cliente? ¿Se puede sin registro? | ✅ Las dos cosas                                         |
| ¿Cómo entran sus motorizados?                  | ✅ Con su cuenta, en `/motorizado`. Ven solo lo suyo     |
| ¿Y Servientrega y Dropi?                       | 🔲 Fase L5, con la investigación hecha                   |

**Lo siguiente del plan** son tres cosas, y ninguna necesita accesos:

1. **La posición del motorizado en vivo** ([#29](https://github.com/juanarrietabusiness-pixel/tommalopty/issues/29)) — cierra L4.2 salvo el mapa
   ([#30](https://github.com/juanarrietabusiness-pixel/tommalopty/issues/30)), y es la única parte que pide migración.
2. **Los avisos automáticos por correo** (P2 número 5). El código se puede
   escribir hoy; solo el envío espera al dominio.
3. **La fase L5**, couriers externos, en cuanto haya credenciales.

**Las liquidaciones (4.d) no están esperando a un programador, sino a una
decisión**: D5, cómo se le paga a un motorizado. La pregunta está escrita, con
las cuatro respuestas posibles y lo que cambia cada una, en el
[issue #28](https://github.com/juanarrietabusiness-pixel/tommalopty/issues/28).
Conviene preguntárselo a la dueña antes que cualquier otra cosa de esta fase.

Dos cosas de L4 estaban atadas al **bucket privado**: la foto de la prueba de
entrega y el comprobante del abono. **El bucket ya existe** —`nebula-media-privada`—
así que el código puede escribir y leer. Lo que falta es la prueba que de verdad
lo valida: abrir el enlace de una foto en una ventana sin sesión y comprobar que
da 403. Punto 19 de la lista de arriba.

**Pero antes conviene cerrar el P1.** Un dominio propio y unas páginas legales no
son trabajo de programación y dependen de decisiones de la dueña: cuanto antes se
pidan, antes dejan de bloquear.

### Lo que hay pedido a terceros

Dos cosas están escritas y esperando una respuesta de fuera. Conviene pedirlas ya,
porque no dependen de nosotros:

| A quién                         | Qué se pide                                                               | Qué desbloquea                       |
| ------------------------------- | ------------------------------------------------------------------------- | ------------------------------------ |
| `integracionesdev@yappy.com.pa` | El **host** de la API de integración (la especificación trae un marcador) | La conciliación automática de cobros |
| `botondepagoyappy@bgeneral.com` | La **especificación del Botón de Pago**                                   | Cobrar con Yappy en el checkout      |

Todo lo demás de Yappy está hecho: ver [`YAPPY.md`](YAPPY.md).

El detalle de cada fase, con criterios de aceptación, está en
[`PLAN-LOGISTICA.md`](PLAN-LOGISTICA.md).
