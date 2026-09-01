# Estado de la plataforma

> **Última actualización:** 1 de septiembre de 2026 (tarde).
> Este documento es el punto de entrada para quien retome el trabajo. Dice qué
> hay publicado, qué está roto, qué se sabe de cada fallo abierto y qué se
> aprendió por las malas. El plan de a dónde vamos está en
> [`PLAN-LOGISTICA.md`](PLAN-LOGISTICA.md); esto es de dónde partimos.

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

La anon key va como **variable y no como secreto** a propósito: viaja en el
navegador de cualquiera que abra la tienda. Lo que protege los datos es RLS, no
el secreto de esa clave.

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
- **Fase L2 casi completa**: los envíos son una entidad propia con su máquina de
  estados, el panel los crea y los mueve, la guía se imprime en 4×6" con su QR,
  la página que abre ese QR funciona en la calle, y quien compró sigue su pedido
  sin registrarse. Falta solo 2.e, los avisos automáticos por correo.

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

## 3. Fallos abiertos

### 🔴 A · El mapa del checkout no muestra imágenes

**Dónde:** `apps/storefront/src/components/selector-de-ubicacion.tsx`,
`packages/ui/src/lib/mapa.ts`.

**Qué se ve:** el recuadro del mapa sale vacío. El pin y el botón «Usar mi
ubicación» sí aparecen porque son elementos propios, no del mapa.

**Qué SÍ funciona, y conviene no volver a dudarlo:**

- MapLibre arranca y responde: al mover el recuadro, el texto de estado cambia a
  «Marcada en el mapa», que solo se escribe desde su evento `moveend`.
- La coordenada se captura, se guarda con su procedencia y llega al pedido.
- WebGL está disponible en el navegador donde se reprodujo (`true`).
- La hoja de estilos de MapLibre se sirve completa (69 KB, 62 reglas).
- El lienzo se crea con el tamaño correcto y los dos controles existen en el DOM.

**Lo que ya se arregló y está verificado en lo publicado:** el contenedor
colapsaba a altura cero por una colisión de CSS con `.maplibregl-map`, que trae
`position: relative` y anulaba el `inset: 0`. Se resolvió con un selector de
mayor especificidad más alto y ancho explícitos, y hay un test end-to-end que
falla sin el arreglo (`tests/e2e/tienda.spec.ts`, «ocupa espacio aunque MapLibre
imponga su position»).

**Lo que queda por confirmar:** tras ese arreglo, la última comprobación del
usuario seguía sin ver el mapa, pero **no se confirmó que hubiera recargado
sobre el despliegue nuevo**. El CSS corregido sí está publicado — verificado
descargándolo del propio servidor.

**Por dónde seguir, en este orden:**

1. Recargar forzando caché (`Ctrl+Shift+R`) sobre el despliegue actual y mirar
   si aparece alguno de los tres mensajes de fallo que el componente ya sabe
   distinguir (sin WebGL / no cargó la librería / no llegan las imágenes).
2. Si sale el de las imágenes, es el proveedor de teselas: ver punto 4.
3. En la pestaña **Network**, filtrar por `cartocdn` y mirar el código de
   respuesta. Un `403` es bloqueo del proveedor; un `net::ERR_BLOCKED_BY_CLIENT`
   es una extensión del navegador.
4. Probar en incógnito y desde un teléfono. Las extensiones de bloqueo de
   rastreo incluyen dominios de mapas en sus listas, y eso le pasará también a
   clientes reales.

**Herramienta útil:** durante la depuración se usó un script de Playwright que
abre el checkout, siembra el carrito en `localStorage` y mide el contenedor del
mapa. No se dejó en el repositorio porque el test end-to-end cubre ya el caso;
reconstruirlo es media hora si hace falta.

### 🟠 B · Las teselas del mapa no tienen proveedor definitivo

`NEXT_PUBLIC_MAP_TILES_URL` apunta hoy al mapa base de CARTO, servido sin clave.
Sirve para desarrollo y para enseñar la pantalla; **no es una decisión tomada
para producción**. Antes de abrir hay que elegir:

| Opción                 | A favor                                                  | En contra                                                                    |
| ---------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **Protomaps sobre R2** | Sin cuota mensual; encaja con tener ya Cloudflare pagado | Hay que generar el extracto de Panamá, subirlo y pasar de ráster a vectorial |
| **MapTiler**           | Inmediato, capa gratuita generosa                        | Requiere cuenta y clave; la clave viaja al navegador                         |
| **CARTO con plan**     | Ya está integrado, cambio cero                           | Coste mensual                                                                |

Primero se usó `tile.openstreetmap.org`. **No volver a hacerlo**: su política
dice expresamente que no está para aplicaciones de terceros.

### 🟢 C · Los tests de RLS y permisos ya corrieron (resuelto)

`packages/db/src/__tests__/` tiene 76 tests que necesitan un Postgres real. En
el entorno donde se escribieron no había Docker, así que se omitían en local y
nunca se habían visto pasar. **Corrieron por primera vez en el PR #21 y pasan
los 76.**

La primera ejecución falló uno, y merece quedar anotado porque es la trampa de
este tipo de test: `dashboard_metrics` comprueba `is_staff()` por su cuenta y
responde «No autorizado.» a cualquier sesión que no sea de equipo. El test se
había validado contra staging con un superadministrador real y pasaba; en CI,
donde la sesión es un `authenticated` cualquiera, falló. **El fallo era del
test, no del esquema.** Ahora crea su propia cuenta con rol de equipo.

Al añadir una pantalla que lea algo nuevo, añade su consulta a
`permisos.test.ts` — con la sesión que esa pantalla usará de verdad.

### 🟡 D · Falta lo que solo se puede hacer con acceso de la dueña

- **Dominio propio** y los dos Workers apuntados a él (paso 0.1 del plan).
- **Cloudflare Access** sobre el panel administrativo (0.5).
- **Backups de Supabase** con retención definida (0.6).
- **Páginas legales** completadas y revisadas por alguien que conozca la ley
  panameña (0.8). Hoy son plantillas.
- **URL pública de R2**: sigue en `r2.dev`, hay que pasarla a dominio propio.
- **`http://localhost:3000/**` en las Redirect URLs de Supabase**: al cambiar el
  Site URL a `workers.dev` se perdió el permiso implícito que tenía el entorno
  local. Sin eso, registrarse desde el equipo de desarrollo no confirma cuentas.

### 🟡 E · Lo que L2 dejó abierto a propósito

- **Los avisos automáticos (2.e)**: los correos que existen no se han ampliado a
  los estados de envío. Es lo único de L2 sin empezar.
- **La foto de la prueba de entrega**: la columna está y apunta a un bucket
  **privado**, que todavía no existe. El bucket de imágenes de producto es
  público y una foto de entrega es la puerta de casa de alguien: no sirve.
- **La cabecera de la tienda se esconde con `:has()`** en la página del
  motorizado, en vez de mover las rutas a un grupo con su propio layout. Es un
  atajo consciente: el grupo obliga a mover veinte carpetas. Cuando alguien haga
  esa reorganización, esas tres líneas de CSS se borran.
- **El saldo de la guía** hoy es el total si el pedido no está pagado. Con los
  abonos (L3) pasará a ser el saldo real.

### 🟡 F · Cosas menores conocidas

- La pantalla de integraciones comprueba `NEXT_PUBLIC_META_PIXEL_ID` con una
  lectura dinámica de `process.env`, que Next no sustituye. Dirá «pendiente»
  aunque esté configurada. Cosmético, afecta a una fila.
- `/cuenta/direcciones` es solo lectura: no se pueden guardar ni reutilizar
  direcciones con su punto en el mapa.
- El panel no enseña todavía el punto del pedido en un mini-mapa. Va con L2.

---

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

Una tabla creada después nace sin privilegios. Está declarado
`alter default privileges` para `authenticated` y `service_role`, que sí alcanza
al futuro. `anon` se deja fuera a propósito: una tabla nueva no debería quedar
expuesta al público por omisión, sino porque alguien lo escribió.

### Un test que no puede fallar no prueba nada

El primer test del mapa pasaba en verde con el CSS roto, porque en desarrollo el
orden de carga de las hojas es el favorable y el fallo solo aparece en el
paquete de producción. **Comprobar siempre que el test falla sin el arreglo.**

---

## 5. Por dónde seguir

Con L1 terminada, lo siguiente del plan es **L2 · trazabilidad**: la guía de
despacho con QR que abre Waze y Google Maps, los estados del envío y el
seguimiento público para el cliente. Es la que convierte la coordenada que ya
se captura en algo que quien entrega usa con una mano, y es la segunda pregunta
de la clienta.

El detalle completo, con criterios de aceptación, está en
[`PLAN-LOGISTICA.md`](PLAN-LOGISTICA.md).
