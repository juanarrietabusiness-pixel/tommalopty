# Estado de la plataforma

> **Última actualización:** 1 de septiembre de 2026.
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
- **Fase L3 casi completa**: se cobran abonos desde el panel, el saldo lo lleva
  la base de datos, y una regla configurable decide si un pedido con saldo puede
  salir del almacén. Falta solo los recordatorios por correo.
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

## 3. Lo que falta, por orden de urgencia

Ordenado por lo que cuesta si no se hace, no por lo que cuesta hacerlo. Los
cuatro primeros bloquean la apertura; el resto se puede hacer con la tienda ya
funcionando.

### 🔴 P1 · Impide abrir al público

| #   | Qué falta                                           | Por qué es crítico                                                                                                                                                          | Quién puede hacerlo                            |
| --- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| 1   | **El mapa del checkout no muestra las imágenes**    | Es la pieza de más impacto de todo el proyecto y la que la clienta pidió primero. La coordenada **sí se captura** y llega al pedido, pero el cliente marca su casa a ciegas | Desarrollo. Diagnóstico completo abajo         |
| 2   | **Dominio propio** y los dos Workers apuntados a él | Hoy las URL son `workers.dev`. No se puede dar a clientes reales, ni cobrar, ni pasar la revisión de una pasarela                                                           | La dueña (comprar el dominio) + desarrollo     |
| 3   | **Páginas legales** completadas y revisadas         | Términos, privacidad, envíos y devoluciones son plantillas. Sin ellas no se puede vender legalmente en Panamá, y ninguna pasarela aprueba el comercio                       | La dueña + alguien que conozca la ley panameña |
| 4   | **Proveedor de teselas del mapa con plan**          | Hoy se usa CARTO sin clave. Su cuota razonable no cubre una tienda en producción                                                                                            | Decisión de la dueña (coste) + desarrollo      |

### 🟠 P2 · Se puede abrir sin ello, pero duele pronto

| #   | Qué falta                                                                                                          | Qué pasa si no está                                                                                                                                                         |
| --- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5   | **Los avisos automáticos por correo** (L2 2.e y L3): despachado, en camino, entregado, recordatorio de vencimiento | El cliente llama por teléfono para preguntar dónde está su pedido. Es el trabajo manual que la plataforma existía para quitar                                               |
| 6   | **Cloudflare Access sobre el panel**                                                                               | El panel administrativo es alcanzable por cualquiera que sepa la URL. RLS protege los datos, pero la pantalla de acceso queda expuesta a fuerza bruta                       |
| 7   | **Backups de Supabase con retención definida**                                                                     | Un borrado accidental no tiene vuelta atrás                                                                                                                                 |
| 8   | **Bucket privado** para la foto de prueba de entrega y el comprobante del abono                                    | Ambas funciones están a medias. El bucket que existe es **público**, y una foto de entrega es la puerta de casa de alguien: no sirve                                        |
| 9   | **Pasarela de pago real conectada**                                                                                | Hoy los pedidos se registran pero no se cobran en línea. Los abonos manuales sí funcionan. Es una decisión de negocio pendiente ([ADR 0006](adr/0006-pasarela-al-final.md)) |

### 🟡 P3 · Deuda conocida, sin urgencia

| #   | Qué                                                                                                                                                                                                            |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 10  | **La URL pública de R2 sigue en `r2.dev`**: hay que pasarla a dominio propio antes de producción                                                                                                               |
| 11  | **`http://localhost:3000/**` falta en las Redirect URLs de Supabase**: sin eso, registrarse desde el entorno de desarrollo no confirma cuentas                                                                 |
| 12  | **La posición del motorizado en ruta** en el seguimiento: depende de que exista su aplicación (fase L4)                                                                                                        |
| 13  | **`/cuenta/direcciones` es solo lectura**: no se pueden guardar ni reutilizar direcciones con su punto                                                                                                         |
| 14  | **La cabecera de la tienda se esconde con `:has()`** en la página del motorizado, en vez de mover las rutas a un grupo con su propio layout. Atajo consciente; se borra cuando alguien haga esa reorganización |
| 15  | **La pantalla de integraciones lee `NEXT_PUBLIC_META_PIXEL_ID` de forma dinámica**, así que dirá «pendiente» aunque esté configurada. Cosmético, afecta a una fila                                             |

---

## 3.1 · El fallo del mapa, con todo lo que ya se descartó

Es el P1 número 1 y el que más tiempo ha costado, así que aquí está todo lo
averiguado para que nadie repita el camino.

**Qué se ve:** el recuadro del mapa sale vacío. El pin y el botón «Usar mi
ubicación» sí aparecen porque son elementos propios, no del mapa.

**Qué SÍ funciona, comprobado y no supuesto:**

- MapLibre arranca y responde: al mover el recuadro, el estado cambia a «Marcada
  en el mapa», texto que solo se escribe desde su evento `moveend`.
- La coordenada se captura, se guarda con su procedencia y llega al pedido.
- WebGL está disponible en el navegador donde se reprodujo (`true` en consola).
- La hoja de estilos de MapLibre se sirve completa: 69 KB, 62 reglas.
- El lienzo se crea con el tamaño correcto y los dos controles existen en el DOM.

**Lo ya arreglado y verificado en producción:** el contenedor colapsaba a altura
cero por una colisión de CSS con `.maplibregl-map`, que trae `position: relative`
y anulaba el `inset: 0`. Resuelto con mayor especificidad más alto y ancho
explícitos, y hay un test end-to-end que **falla sin el arreglo**.

**Lo que queda por confirmar:** tras ese arreglo la última comprobación seguía
sin ver el mapa, pero no se confirmó que se hubiera recargado sobre el despliegue
nuevo. El CSS corregido sí está publicado.

**Por dónde seguir, en este orden:**

1. Recargar forzando caché (`Ctrl+Shift+R`) y mirar si aparece alguno de los tres
   mensajes de fallo que el componente ya distingue: sin WebGL / no cargó la
   librería / no llegan las imágenes.
2. En **Network**, filtrar por `cartocdn` y mirar el código de respuesta. Un
   `403` es bloqueo del proveedor; `ERR_BLOCKED_BY_CLIENT` es una extensión.
3. Probar en incógnito y desde un teléfono. Los bloqueadores de rastreo incluyen
   dominios de mapas en sus listas, y eso le pasará también a clientes reales.

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

**Las siete preguntas de la clienta, hoy:**

| Pregunta                                       | Estado                                                              |
| ---------------------------------------------- | ------------------------------------------------------------------- |
| ¿Podrá seguir sus pedidos?                     | ✅ Con línea de tiempo, y sin registrarse                           |
| ¿La dirección se marca en un mapa?             | 🔶 La coordenada se captura y llega al pedido; **el mapa no se ve** |
| ¿La guía lleva QR que abra Waze y Maps?        | ✅ Guía imprimible en 4×6" con su QR                                |
| ¿Puede recibir abonos y despachar al cuadrar?  | ✅ Con tres reglas de despacho a elegir                             |
| ¿Hay panel de cliente? ¿Se puede sin registro? | ✅ Las dos cosas                                                    |
| ¿Cómo entran sus motorizados?                  | 🔲 Fase L4                                                          |
| ¿Y Servientrega y Dropi?                       | 🔲 Fase L5, con la investigación hecha                              |

**Lo siguiente del plan es la fase L4**, la comunidad de motorizados. Desbloquea
tres cosas que hoy están a medias: la posición en ruta, la prueba de entrega con
foto y la liquidación de lo cobrado contra entrega.

**Pero antes conviene cerrar el P1.** Un dominio propio y unas páginas legales no
son trabajo de programación y dependen de decisiones de la dueña: cuanto antes se
pidan, antes dejan de bloquear.

El detalle de cada fase, con criterios de aceptación, está en
[`PLAN-LOGISTICA.md`](PLAN-LOGISTICA.md).
