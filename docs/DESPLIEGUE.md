# Despliegue

> Esto explica **cómo funciona** el despliegue. Si lo que buscas es la lista
> ordenada de lo que hay que enchufar —migraciones, bucket privado, dominio,
> correo— con su verificación paso a paso, eso está en
> [`CONECTAR.md`](CONECTAR.md).

## Entornos

| Entorno    | Rama      | Supabase                        | Pasarelas  |
| ---------- | --------- | ------------------------------- | ---------- |
| Desarrollo | local     | Supabase local (Docker)         | sandbox    |
| Staging    | `develop` | `tommalopty-staging` (existe)   | sandbox    |
| Producción | `main`    | Proyecto Supabase de producción | producción |

Cada entorno tiene **su propio juego de variables y credenciales**. Nunca
compartir la service-role key ni las claves de pasarela entre entornos.

## Variables de entorno

Los nombres exactos están en [`.env.example`](../.env.example). Reglas:

- `NEXT_PUBLIC_*` se incrusta en el bundle del navegador. Solo valores públicos.
- `SUPABASE_SERVICE_ROLE_KEY` **salta RLS**: solo en servidor, nunca en el
  cliente ni en logs.
- Las claves de pasarelas de pago, Meta y email viven en el secret store del
  hosting. La tabla `integrations` solo guarda el interruptor de activación y
  configuración no sensible.
- **Ninguna credencial llega por un conector MCP.** Un MCP conectado al asistente
  de quien desarrolla es su cuenta personal y no toca esta plataforma: el código
  solo lee `process.env`. Quién se autentica con qué, y qué no puede hacer una
  sesión de trabajo sin acceso, está en
  [`ESTADO.md` § 1](ESTADO.md) → «Quién tiene acceso a qué».

## Base de datos

Las migraciones son la fuente de verdad del esquema. Se aplican en orden:

```bash
# Enlazar el proyecto (una sola vez por entorno)
supabase link --project-ref <ref-del-proyecto>

# Aplicar migraciones pendientes
supabase db push

# Regenerar los tipos después de cambiar el esquema
pnpm db:types
```

Nunca editar el esquema a mano desde el panel de Supabase: se pierde la
trazabilidad y el siguiente `db push` puede chocar. Crear siempre una migración.

**El despliegue no aplica migraciones.** El workflow de «Publicar en staging»
construye y despliega los Workers; la base de datos no la toca. Aplicar una
migración es un `supabase db push` deliberado, desde una máquina con acceso al
proyecto.

**Contra staging, `db push` — nunca `db reset`.** El `reset` borra y reconstruye,
y staging guarda datos reales. El `pnpm db:reset` de este repositorio es
`--local` y no llega a un proyecto remoto, pero conviene saberlo antes de
escribirlo con prisa.

**Backups:** activar los backups automáticos de Supabase y definir la política
de retención antes de abrir la tienda al público.

**Revisar los avisos de seguridad después de cada cambio de esquema.** Supabase
trae un linter que mira la base ya aplicada, no el SQL, y por eso ve cosas que
la revisión de código no. Encontró dos reales en este proyecto (ver la migración
0020): un `revoke ... from anon` que no revocaba nada, y las funciones de
disparador expuestas como endpoints REST. Se consulta desde el panel del
proyecto, en **Advisors → Security**.

## Publicación en Cloudflare

Las dos apps se despliegan por separado (dos proyectos de Cloudflare Workers),
cada una con su dominio:

- `storefront` → dominio principal de la tienda
- `admin` → subdominio propio (p. ej. `panel.tudominio.com`)

Recomendado además para el panel: restringir el acceso con Cloudflare Access,
de modo que ni siquiera se llegue a la pantalla de login desde fuera del equipo.

### Build

Las apps usan el adaptador [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare):

```bash
pnpm --filter @nebula/storefront cf:build      # genera el bundle de Workers
pnpm --filter @nebula/storefront cf:preview    # pruébalo en local con workerd
pnpm --filter @nebula/storefront cf:deploy     # publica
```

Y lo mismo con `@nebula/admin`.

> El adaptador requiere una cuenta de Cloudflare autenticada (`wrangler login`)
> para `cf:deploy`. Los comandos `cf:*` no forman parte de CI: el pipeline valida
> con `next build`, que es lo que detecta errores de código.

### Por qué las apps usan `middleware.ts` y no `proxy.ts`

Next 16 marca `middleware.ts` como obsoleto a favor de `proxy.ts`, pero `proxy`
solo corre en runtime Node y `@opennextjs/cloudflare` todavía no lo soporta
(falla con _"Node.js middleware is not currently supported"_). Como el hosting
elegido es Cloudflare, las dos apps se quedan en `middleware.ts` —que compila a
edge y sí despliega— hasta que el adaptador añada soporte. El aviso de
deprecación durante el build es esperado.

### Configuración por app

Cada app tiene su `wrangler.jsonc` con:

- `name` — el proyecto de Cloudflare al que despliega
- `compatibility_flags: ["nodejs_compat"]` — necesario para el runtime de Next
- variables públicas en `vars`

Los secretos **no van en `wrangler.jsonc`** (está en git). Se cargan con:

```bash
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put PAYPAL_CLIENT_SECRET
# …
```

## Almacenamiento de imágenes

Las imágenes viven en **Cloudflare R2**, no en Supabase Storage
([ADR 0007](adr/0007-media-en-cloudflare.md)). Hay dos caminos y no se deben
confundir:

|              | Subir                                          | Servir                          |
| ------------ | ---------------------------------------------- | ------------------------------- |
| Quién        | El Worker del panel                            | Cualquier navegador             |
| Cómo         | Binding `MEDIA` de `apps/admin/wrangler.jsonc` | El dominio público del bucket   |
| Credenciales | **Ninguna.** El binding no usa claves          | No aplica: es contenido público |

### El bucket

`nebula-media`, creado en agosto de 2026. La subida funciona por el binding y no
necesita ninguna variable. Lo que sí hace falta es decirle a las aplicaciones
**desde qué dominio se sirve lo ya subido**, en `NEXT_PUBLIC_R2_PUBLIC_URL`.

Sin esa variable el panel **se niega a subir**, a propósito: guardaría un objeto
cuya URL nadie puede componer, y la imagen se vería rota sin que nadie supiera
por qué.

| Entorno                   | Valor                                                                       |
| ------------------------- | --------------------------------------------------------------------------- |
| Desarrollo y demostración | `https://pub-524ecdb67a9a4230b194ae8a7de615e3.r2.dev`                       |
| Producción                | Un dominio propio conectado al bucket, p. ej. `https://media.tudominio.com` |

**La URL `r2.dev` no es para producción.** Cloudflare la limita por tasa y lo
dice en su documentación: existe para desarrollo y para enseñar la plataforma.
Antes de abrir la tienda hay que conectar un dominio propio al bucket, desde
R2 → `nebula-media` → Settings → Custom Domains.

**Cambiar de dominio no mueve nada.** Las claves de los objetos son las mismas;
solo cambia quién las sirve. Lo que sí hay que hacer es reescribir las URL ya
guardadas en `product_images.url` y en `cms_banners.media_url`, que llevan el
dominio dentro. Un `update` con `replace()` sobre esas dos columnas basta.

### El segundo bucket: el privado

Hay **dos**, y la diferencia no es de configuración sino de qué se guarda en
cada uno.

`nebula-media` es público y tiene que serlo: una foto de catálogo la pide el
navegador de cualquiera que abra la tienda, y servirla por un Worker sería pagar
CPU por cada miniatura.

`nebula-media-privada` **no tiene dominio público, y no debe tenerlo**. Guarda
dos cosas:

- La **foto de la prueba de entrega**, que es la puerta de casa de alguien y a
  veces con la persona en el encuadre.
- El **comprobante de un abono**, que suele ser la captura de una transferencia
  bancaria con nombres, saldos y números de cuenta.

Se crea una sola vez, y hace falta acceso a la cuenta de Cloudflare:

```bash
wrangler r2 bucket create nebula-media-privada
```

**No se le pone dominio público ni acceso `r2.dev`.** El binding ya está
declarado como `MEDIA_PRIVADA` en los dos `wrangler.jsonc`; el despliegue no
necesita nada más.

Mientras el bucket no exista, subir una foto o un comprobante avisa con un
mensaje claro y no rompe nada: la entrega se cierra igual y el abono se registra
igual.

#### Por qué la clave del objeto no viaja en ninguna URL

Un bucket privado del que se reparten enlaces firmados sigue siendo un bucket del
que se reparten enlaces: el enlace se reenvía, se queda en un historial y aparece
en una captura.

Aquí la clave se guarda en la fila —`shipments.delivery_proof_key`,
`payments.receipt_key`— y **no llega nunca al navegador**. Para ver el fichero se
pide _la cosa que documenta_: `/api/privado/entrega/<id del envío>` o
`/api/privado/abono/<id del pago>`. Esa ruta lee la fila con el cliente de
sesión, así que **quien decide si se puede ver es RLS**, la misma que decide todo
lo demás. Si la fila no se puede leer, no hay clave; sin clave, no hay bytes.

### Lo que este bucket es y lo que no

`nebula-media` es **público**: cualquiera con la URL de un objeto lo ve, sin
sesión. Es lo correcto para fotos de catálogo y del CMS, que existen para ser
vistas.

**No vale para las pruebas de entrega de la fase L4.** Esas fotos llevan la
puerta de la casa de un cliente, y en un bucket público bastaría con adivinar
una clave. Van en un bucket aparte, privado, servidas con URL firmada de
caducidad corta. Está en el [plan de logística](PLAN-LOGISTICA.md); se menciona
aquí para que a nadie le tiente reutilizar este bucket por comodidad.

### Si algún día se pasa a `next/image`

Habría que añadir el dominio a `images.remotePatterns` en el `next.config.ts` de
la tienda. Hoy se usa `<img>` a propósito, porque el dominio varía por entorno.

### Variable de repositorio para la previsualización

El enlace de previsualización de cada PR construye en modo demostración, donde
no se puede subir nada, pero sí se ven las imágenes que ya estén en el bucket.
Para que las vea, en **Settings → Secrets and variables → Actions → Variables**
del repositorio: `R2_PUBLIC_URL` con el valor de la tabla de arriba. Es una
variable, no un secreto: la URL es pública por definición.

## Ver la plataforma funcionando, sin dominio

**No hace falta dominio propio para probar.** Cloudflare da una URL
`workers.dev` gratis a cada Worker, y con eso se navega la tienda y el panel
desde cualquier teléfono. El dominio hace falta para _producción_ —para que la
tienda tenga una dirección presentable, para poner Cloudflare Access sobre el
panel y para servir las imágenes desde un dominio propio—, no para comprobar
que algo funciona.

### Dos modalidades, y la diferencia importa

|                          | `preview.yml`                                                | `staging.yml`           |
| ------------------------ | ------------------------------------------------------------ | ----------------------- |
| Base de datos            | Ninguna (modo demostración)                                  | La de staging, real     |
| ¿Se guarda lo que edito? | **No.** Todo responde «esto es un recorrido de demostración» | **Sí**                  |
| Para qué sirve           | Enseñar el diseño                                            | Comprobar que funciona  |
| Iniciar sesión           | No hace falta, y no se puede                                 | Sí, con una cuenta real |

Es la distinción que más confusión causa: en la previsualización, subir una
imagen, crear una variante o editar un menú **no fallan, pero tampoco guardan**.
Para verificar lo construido hay que usar `staging.yml`.

### Configurarlo una sola vez

En **Settings → Secrets and variables → Actions** del repositorio.

**Variables** (no son secretos: la anon key viaja en el navegador de cualquiera
que abra la tienda, y lo que protege los datos es RLS):

| Variable                    | Valor                                                           |
| --------------------------- | --------------------------------------------------------------- |
| `STAGING_SUPABASE_URL`      | `https://pdbeqkxhrqicgfhcanwl.supabase.co`                      |
| `STAGING_SUPABASE_ANON_KEY` | La clave `anon` del proyecto, en Supabase → Settings → API Keys |
| `R2_PUBLIC_URL`             | `https://pub-524ecdb67a9a4230b194ae8a7de615e3.r2.dev`           |
| `STAGING_SITE_URL`          | La URL `workers.dev` de la tienda, tras el primer despliegue    |
| `STAGING_ADMIN_URL`         | La URL `workers.dev` del panel, tras el primer despliegue       |

**Secret** (este sí lo es, y mucho: **salta RLS por completo**):

| Secret                              | De dónde sale                                   |
| ----------------------------------- | ----------------------------------------------- |
| `STAGING_SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API Keys → `service_role` |

Sin ese secreto todo funciona salvo **confirmar un pedido**: el checkout crea el
pedido con service-role porque quien compra puede ser invitado y no tiene sesión
que RLS pueda autorizar.

Las dos primeras variables (`STAGING_SITE_URL` y `STAGING_ADMIN_URL`) son un
huevo y gallina: hasta el primer despliegue no se conocen. Se deja en blanco,
se despliega, y se rellenan con las URL que imprime el resumen. Solo afectan a
las canónicas y al enlace «Ver en la tienda» del panel.

### Publicar

**Actions → Publicar en staging → Run workflow**, eligiendo la rama. El resumen
de la ejecución imprime las dos URL.

Si falta algo, el workflow no despliega a medias: falla y dice exactamente qué
variable o secreto poner.

### La primera cuenta

La base de staging arranca con catálogo pero **sin usuarios**, así que al panel
no entra nadie todavía. El orden es:

1. Registrarse en la tienda, en `/registro`.
2. Promover esa cuenta desde el editor SQL de Supabase:

   ```sql
   update public.profiles set role = 'superadmin' where email = 'tu@correo.com';
   ```

3. Entrar al panel con ella.

Desde ahí, el resto de roles se gestionan en el propio panel.

## Enseñar la plataforma: previsualización

Dos niveles, y conviene tener clara la diferencia porque una de las dos cosas
**no la puede dar GitHub Actions**.

### 1. Capturas — funciona hoy, sin ninguna cuenta

El trabajo `capturas` de [`preview.yml`](../.github/workflows/preview.yml)
levanta la tienda **y el panel** en modo demostración y fotografía todo:
portada, catálogo, carrito y checkout en tres tamaños, y las dieciocho pantallas
del panel en escritorio y móvil. Las deja adjuntas al PR.

Son imágenes. Sirven para revisar diseño y para una presentación, pero no se
navegan.

### 2. Enlace en vivo — necesita una cuenta de Cloudflare

**GitHub Actions no puede alojar la aplicación.** Sus runners son efímeros: se
apagan al terminar el trabajo. Lo único que deja es un artefacto descargable.
Para que exista una URL que alguien pueda abrir y recorrer, hace falta un sitio
donde el Worker se quede corriendo, y eso es Cloudflare.

El trabajo `enlace` ya está escrito y **solo está dormido por falta de
credenciales**. Cuando existan, cada PR —y cada ejecución manual— publica dos
URLs: tienda y panel.

#### Qué configurar, exactamente

En **Settings → Secrets and variables → Actions** del repositorio, dos secretos.
Solo dos:

| Secreto                 | De dónde sale                                                             |
| ----------------------- | ------------------------------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`  | Cloudflare → My Profile → API Tokens, plantilla _Edit Cloudflare Workers_ |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare → Workers & Pages, en la barra lateral derecha                 |

**No hacen falta los de Supabase**, y es deliberado: la previsualización se
construye en modo demostración. Con base de datos conectada, el panel exigiría
iniciar sesión y quien abriera el enlace vería la pantalla de acceso y nada más
— justo lo contrario de lo que una previsualización tiene que enseñar. Además,
un enlace público apuntando a la base de staging es superficie de ataque sin
motivo; en modo demostración no hay base que atacar.

#### Publicar la demostración sin abrir un PR

El workflow acepta disparo manual. En **Actions → Previsualización del PR → Run
workflow**, eligiendo la rama. Las URLs salen en el resumen de la ejecución.

Es la vía para tener un enlace estable que enseñar, sin depender de que haya un
pull request abierto.

#### La primera ejecución crea los Workers

`wrangler versions upload` sube una versión de un Worker **que ya existe**. En
una cuenta recién creada no existe ninguno, así que el trabajo detecta el fallo,
lanza un `wrangler deploy` que lo crea, y reintenta. Solo ocurre la primera vez.

Consecuencia que conviene saber: ese despliegue inicial deja los Workers
publicados en sus URLs de producción (`nebula-storefront.<subdominio>.workers.dev`
y `nebula-admin.<subdominio>.workers.dev`), en modo demostración. Para enseñar la
propuesta es justo lo que hace falta; si no se quiere, se borran desde el panel
de Cloudflare tras la primera ejecución.

#### Detalles del enlace de PR

- **Es una versión subida, no promovida.** Producción no se toca al añadir
  commits.
- **El enlace no cambia** mientras se añadan commits al mismo PR, porque el
  alias se deriva del número de pull request.

Mientras no existan los secretos, el trabajo **se salta con un aviso** en lugar
de dejar el PR en rojo.

#### Alternativa sin GitHub Actions

Cloudflare también ofrece integración directa con el repositorio (**Workers
Builds**): conectas el repo desde el panel y Cloudflare construye cada PR y
comenta la URL por su cuenta, sin workflow. Es menos configurable, pero si el
equipo prefiere no mantener el workflow de despliegue, es una opción válida.
Los trabajos de tests seguirían en GitHub Actions igual.

## Qué se ejecuta y cuándo

| Evento                   | Qué corre                                                                                                         |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| Abrir o actualizar un PR | Formato, lint, tipos, unitarios, esquema + RLS, build, E2E + accesibilidad, capturas y enlace de previsualización |
| Push a `develop`         | Todo lo anterior salvo la previsualización                                                                        |
| Push a `main`            | Todo lo anterior salvo la previsualización                                                                        |

Al terminar, un comentario en el PR resume el estado de cada comprobación en
una tabla. Se edita el mismo comentario en cada commit, en lugar de apilar uno
nuevo cada vez.

## CI/CD

[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) ejecuta en cada PR:

1. `pnpm format:check` — formato
2. `pnpm lint` — ESLint
3. `pnpm typecheck` — TypeScript estricto
4. `pnpm test` — tests unitarios
5. `pnpm build` — build de producción de ambas apps
6. Un job aparte levanta Supabase y comprueba que las migraciones aplican
   limpias, incluido el linter de esquema (detecta tablas sin RLS).

## Lista de comprobación antes de producción

- [ ] Pasarelas de pago implementadas y probadas en sandbox
- [ ] Webhooks apuntando al dominio de producción y con firma verificada
- [ ] Backups automáticos de Supabase activos, con retención definida
- [ ] Panel protegido con Cloudflare Access
- [ ] Dominio propio conectado al bucket R2, y `NEXT_PUBLIC_R2_PUBLIC_URL`
      apuntando a él en vez de a `r2.dev` (limitada por tasa)
- [ ] Al menos un `superadmin` creado y los roles del equipo asignados
- [ ] Contenido real: catálogo, banners, páginas legales
- [ ] Meta Pixel y Conversions API verificados en el Events Manager
- [ ] Emails transaccionales enviando desde un dominio verificado
- [ ] Revisada la política de envíos y devoluciones con la clienta
