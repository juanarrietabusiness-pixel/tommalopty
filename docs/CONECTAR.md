# Conectar los cables

> **Para quién es esto:** la persona que sí tiene acceso a Supabase y a
> Cloudflare —o su sesión de Claude con esos conectores puestos— y que va a
> dejar la plataforma funcionando de verdad.
>
> Todo lo que hay aquí está construido, probado y mergeado. Lo que falta es
> **conectarlo**, y eso requiere accesos que las sesiones de desarrollo no han
> tenido nunca. Por qué no los han tenido y qué significa eso está en
> [`ESTADO.md` § 1](ESTADO.md) → «Quién tiene acceso a qué».

---

## ✅ Estado: los pasos 1 a 5 están hechos

El 1 de septiembre de 2026, una sesión con los conectores de Supabase y
Cloudflare puestos ejecutó esta guía. **Lo que queda —del 6 en adelante— cuelga
todo del dominio, y el dominio hay que comprarlo.**

| Paso                      | Estado                                                                                                                                                  |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 · Las tres migraciones  | ✅ Aplicadas en orden. `courier` en el enum, `couriers`/`courier_zones` con sus políticas, `payments.receipt_key`                                       |
| 2 · Regenerar los tipos   | ⚠️ 44 tablas y 1277 campos comparados uno a uno contra staging, y cuatro diferencias corregidas — pero **CI sigue avisando de que difieren**. Ver abajo |
| 3 · Advisors de seguridad | ✅ Revisados. Dos hallazgos reales arreglados; el resto, explicado abajo                                                                                |
| 4 · El bucket privado     | ✅ `nebula-media-privada` existe. **Falta la prueba de punta a punta** (el 403 sin sesión)                                                              |
| 5 · Revocar `anon`        | ✅ Migración 0033, tabla por tabla, con 36 tests nuevos. Cierra el [issue #24]                                                                          |
| 6 · El dominio            | 🔲 **Bloqueado**: hay que comprarlo. Es el P1 número 2                                                                                                  |
| 7 · Antes de abrir        | 🔲 Backups, Cloudflare Access, plan de teselas, cuentas a nombre del negocio                                                                            |
| 8 · Lo de después         | 🔲 Lo que pide accesos de cada fase que queda. Está al final de este documento                                                                          |

[issue #24]: https://github.com/juanarrietabusiness-pixel/tommalopty/issues/24

### Lo nuevo desde entonces: la fase L4.2, y lo que **no** pide

El 2 de septiembre entró la pantalla de **Despacho** (`/despacho` en el panel):
a quién darle cada envío con el motivo de cada candidato, y en qué orden
conviene repartir, con los kilómetros que ahorra.

**No pide nada de ti.** Ni migración, ni variable nueva, ni bucket, ni
credencial. Usa las tablas que el paso 1 ya aplicó (`couriers`, `courier_zones`,
`shipments`) y dos funciones puras del dominio. **Lo único que hace falta para
verla es volver a publicar**: Actions → «Publicar en staging» → Run workflow.

Se dice aquí porque la pregunta natural al leer «fase nueva» es «¿y qué tengo
que enchufar?», y esta vez la respuesta es «nada».

Lo que sí queda de L4.2, y por qué no está:

| Qué                                    | Por qué falta                                                                                                                   | Issue |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ----- |
| La **posición del motorizado en vivo** | Es lo único de la fase que pide migración, y está escrita en el issue lista para aplicar                                        | [#29] |
| El **mapa** de la pantalla             | Aparcado a propósito **detrás del plan de teselas**: un mapa abierto toda la jornada consume más cuota que decenas de checkouts | [#30] |
| Las **liquidaciones**                  | No espera a un programador: espera a que la dueña conteste cómo se le paga a un motorizado                                      | [#28] |

[#28]: https://github.com/juanarrietabusiness-pixel/tommalopty/issues/28
[#29]: https://github.com/juanarrietabusiness-pixel/tommalopty/issues/29
[#30]: https://github.com/juanarrietabusiness-pixel/tommalopty/issues/30

### Lo que se encontró al hacerlo, y que no estaba previsto

- **Los tipos editados a mano estaban casi bien.** De 1277 campos, cuatro
  fallaban: `orders.balance_due` y `products.search_vector` faltaban en `Insert` y
  `Update` —las dos son columnas que Postgres calcula solo, y quien las editó a
  mano las omitió por eso mismo—, y `audit_log.ip_address` y
  `products.search_vector` tenían un tipo más específico del que produce el
  generador. Corregidos los cuatro. **Aun así CI sigue avisando de que difieren**,
  y el porqué está en el paso 2: la comparación a mano fue contra staging, y CI
  genera desde las migraciones del repositorio.
- **`anon` tenía menos privilegios en staging que los que describe el issue #24.**
  No porque el issue se equivocara, sino porque `pg_default_acl` tiene una entrada
  por cada rol que crea tablas: la de `supabase_admin` concede los siete, la de
  `postgres` —que es quien ejecuta las migraciones— concedía cuatro. El que
  importaba, `truncate`, estaba en las dos.
- **Dos funciones de disparador sin `search_path` fijo**, y son precisamente las
  dos que deciden si un motorizado puede reasignarse un envío. Arreglado en la
  migración 0034.

---

## Antes de tocar nada

**Un conector MCP sobre la base real es acceso de escritura.** No es una
integración: es una llave. `apply_migration` y `execute_sql` van directos al
proyecto remoto. Conviene tenerlo presente y revocarlo al terminar si la sesión
era de una cuenta personal.

**Contra staging: `supabase db push`, nunca `supabase db reset`.** El `reset`
borra y reconstruye, y staging **guarda datos reales** — hay pedidos, envíos y
abonos de prueba que sostienen lo que se enseña. El `pnpm db:reset` de este
repositorio es `--local` y no llega a un proyecto remoto, pero conviene saberlo
antes de escribirlo con prisa.

**Ninguna credencial se pega en un chat, en un commit ni en un issue.** Los
valores van a GitHub → Settings → Secrets and variables → Actions, o a un
`.env.local` que está en `.gitignore`.

**El orden de abajo importa.** Cada paso desbloquea el siguiente, y los dos
primeros son los que hacen que lo ya construido empiece a funcionar.

---

## 1 · Aplicar las tres migraciones pendientes

**Qué desbloquea:** los motorizados y los ficheros privados. Sin esto, el panel
tiene una pantalla de Motorizados que no puede leer su tabla.

| Migración                              | Qué hace                                                                                                                                              |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `20260901180000_rol_motorizado.sql`    | Añade el valor `courier` al enum `user_role`. **Va sola** porque Postgres no deja usar un valor nuevo de un enum en la misma transacción que lo añade |
| `20260901190000_motorizados.sql`       | Tablas `couriers` y `courier_zones`, políticas RLS y el disparador `guard_courier_shipment_update`                                                    |
| `20260901200000_ficheros_privados.sql` | `payments.receipt_key`, la clave del comprobante del abono                                                                                            |

**Cómo:**

```bash
supabase link --project-ref pdbeqkxhrqicgfhcanwl   # una sola vez
supabase db push
```

Con el MCP de Supabase, `apply_migration` una por una **y en ese orden**. La
primera tiene que estar confirmada antes de mandar la segunda: si van en la
misma transacción, la segunda falla con «unsafe use of new value of enum type».

**Cómo verificar:**

```sql
select unnest(enum_range(null::public.user_role));           -- debe incluir 'courier'
select count(*) from public.couriers;                         -- 0, pero no error
select column_name from information_schema.columns
  where table_name = 'payments' and column_name = 'receipt_key';
```

Con el MCP: `list_migrations` y `list_tables`.

---

## 2 · Regenerar los tipos y confirmar que no difieren

**Por qué:** los tipos generados se editaron **a mano**, porque el CLI de
Supabase necesita Docker y las sesiones de desarrollo no lo tenían. Están
escritos siguiendo el formato exacto del fichero, pero nadie los ha generado de
verdad. Ver [issue #5](https://github.com/juanarrietabusiness-pixel/tommalopty/issues/5).

```bash
pnpm db:types
git diff --stat packages/db/src/generated/database.types.ts
```

Si el diff sale vacío, las ediciones a mano eran correctas. Si no, **el generado
manda**: se commitea y se comprueba que `pnpm typecheck` sigue pasando.

**⚠️ Este paso está a medias, y conviene saberlo antes de darlo por bueno.** Los
1277 campos se compararon uno a uno contra el esquema real de staging y las
cuatro diferencias se corrigieron — pero **CI sigue avisando de que difieren** en
cada ejecución sobre `main`, la última incluida (`22f36d2`).

No son afirmaciones contradictorias: se compararon cosas distintas. La
comparación a mano fue contra **staging**; CI genera desde las **migraciones del
repositorio**, en un Supabase local. Que difieran significa una de dos cosas, y
las dos importan:

- staging tiene algo que las migraciones no reproducen —lo cual haría que una
  base nueva no saliera igual—, **o**
- el generador escribe un detalle de formato distinto del que se escribió a mano.

Lo segundo es inofensivo; lo primero no. **Hasta ahora nadie podía distinguirlo,
porque el aviso decía que algo difería y no decía qué.** Desde el 2 de
septiembre, CI vuelca el diff completo en el resumen del job, así que la
respuesta está a un clic: Actions → la última ejecución de CI → job **«Esquema y
políticas RLS»** → resumen.

**Lo que hay que hacer con eso:** mirarlo, y según lo que diga, o commitear el
generado, o escribir la migración que falta. Cuando el diff salga vacío, el aviso
se puede convertir en fallo duro —es la segunda mitad del
[issue #5](https://github.com/juanarrietabusiness-pixel/tommalopty/issues/5)— y
entonces esto no se vuelve a acumular en silencio.

---

## 3 · Mirar los avisos de seguridad de Supabase

**Por qué:** el linter de Supabase mira la base ya aplicada, no el SQL, y por eso
ve cosas que la revisión de código no. Encontró dos fallos reales en este
proyecto (migración 0020): un `revoke ... from anon` que no revocaba nada, y
funciones de disparador expuestas como endpoints REST.

Panel del proyecto → **Advisors → Security**. Con el MCP: `get_advisors`.

Hacerlo **después** de aplicar las migraciones, no antes: lo que interesa es lo
que digan de las tablas nuevas.

#### Lo que encontró, y qué se hizo con cada cosa

**Arreglado** (migración 0034): `guard_shipment_transition` y
`guard_courier_shipment_update` no fijaban su `search_path`. Sin él, los nombres
sin cualificar los resuelve quien dispara la operación — y estas dos son
exactamente las que deciden si un motorizado puede reasignarse un envío. Hoy sus
cuerpos ya cualifican todo, así que no cambiaba ningún comportamiento; cierra la
puerta para el día que alguien añada una llamada sin cualificar.

**Pendiente, y es un clic que no se puede dar desde aquí:** _Leaked Password
Protection_ está desactivado. Se enciende en el panel de Supabase →
Authentication → Policies. Comprueba las contraseñas nuevas contra
HaveIBeenPwned. No tiene coste y no requiere ningún cambio de código.

**Lo que NO hay que "arreglar", y conviene leerlo antes de tocarlo**, porque son
avisos correctos sobre un diseño deliberado:

| Aviso                                                                                                        | Por qué se queda así                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `admin_bootstrap` tiene RLS activo y ninguna política                                                        | **Es el objetivo.** RLS sin políticas significa que nadie pasa, y además está revocada para los tres roles. Una política aquí sería abrir una puerta que se cerró a propósito                                                                                                     |
| `is_staff()`, `is_admin()`, `is_courier()`, `current_courier_id()`… ejecutables por `anon` y `authenticated` | **No se pueden revocar sin romperlo todo.** Las políticas RLS las llaman, y Postgres evalúa la expresión de una política con los permisos de quien consulta: sin `execute`, cada consulta a cada tabla protegida falla. Y no filtran nada: solo dicen quién es **quien pregunta** |
| `validate_discount(...)` ejecutable por `anon`                                                               | La tienda valida el código de descuento antes del checkout, sin sesión. Es su motivo de existir                                                                                                                                                                                   |

La regla para el siguiente que mire esta lista: **un aviso del linter es una
pregunta, no una orden.** Revocar el `execute` de `is_staff()` para dejar el panel
en verde tumbaría la tienda entera, y el linter no lo sabe.

---

## 4 · Crear el bucket privado de R2

**Qué desbloquea:** la foto de la prueba de entrega y el comprobante del abono.
El código ya escribe y lee de él; mientras no exista, subir avisa con un mensaje
claro y no rompe nada.

**✅ Ya está creado.** `nebula-media-privada` existe en la cuenta. Se creó con:

```bash
wrangler r2 bucket create nebula-media-privada
```

Con el MCP de Cloudflare: `r2_bucket_create`.

**Lo que falta es la verificación de abajo**, y no es un trámite: es el único
paso que demuestra que el bucket es de verdad privado. Nadie la ha hecho todavía
porque hace falta una sesión con el panel abierto y un motorizado dado de alta.

**⚠️ No le pongas dominio público ni habilites el acceso `r2.dev`.** Ahí van
fotos de la puerta de casa de clientes y capturas de transferencias bancarias. El
binding `MEDIA_PRIVADA` ya está declarado en los dos `wrangler.jsonc`; el
despliegue no necesita nada más.

**Cómo verificar, de punta a punta:**

1. Publicar en staging (Actions → «Publicar en staging»).
2. Dar de alta un motorizado en el panel y asignarle un envío.
3. Entrar a `/motorizado` con esa cuenta, abrir la entrega y cerrarla con foto.
4. En el panel, el envío debe mostrar **«Ver la prueba de entrega»**, y el enlace
   debe abrir la foto.
5. Copiar ese enlace y abrirlo **en una ventana privada, sin sesión**: tiene que
   dar 403 o 404, nunca la foto.

El paso 5 es el que de verdad prueba que el bucket es privado.

---

## 5 · Revocar `anon` de las tablas que no lo necesitan

**Qué arregla:** [issue #24](https://github.com/juanarrietabusiness-pixel/tommalopty/issues/24).
Toda tabla de `public` nace con los siete privilegios para `anon`, porque el
arranque de Supabase declara sus propios `alter default privileges`. Con RLS bien
puesta, `select`, `insert`, `update` y `delete` no devuelven ni tocan nada;
**`truncate` sí pasa**, porque no está sujeto a políticas de fila.

Las tablas de la fase L4 ya lo revocan. Las anteriores no.

**⚠️ Revisar una por una, y no con un bucle.** `delivery_zones` y el catálogo
público **sí necesitan** `select` para `anon`: quitárselo deja la tienda sin
catálogo, que es exactamente lo que ya pasó durante once días
([`ESTADO.md` § 4](ESTADO.md)).

Para ver quién tiene qué:

```sql
select table_name, string_agg(privilege_type, ',' order by privilege_type)
from information_schema.role_table_grants
where grantee = 'anon' and table_schema = 'public'
group by table_name order by table_name;
```

El issue lleva la lista de candidatas y lo que falta.

---

## 6 · El dominio, y todo lo que cuelga de él

**Es el P1 número 2, y desbloquea tres cosas a la vez.** Hasta que exista, las
URL son `workers.dev`: no se puede dar a clientes reales, ni pasar la revisión de
una pasarela, ni verificar un remitente de correo.

En orden:

1. **Comprar el dominio** y apuntarlo a Cloudflare.
2. **Los dos Workers**, con su ruta. Y de paso pasar la URL pública de R2 de
   `r2.dev` a dominio propio (punto 10 de la lista de `ESTADO.md`).
3. **Resend**: verificar el dominio con sus DNS, crear una clave de solo envío, y
   pegar `STAGING_RESEND_API_KEY` (secreto), `STAGING_EMAIL_FROM` y
   `STAGING_EMAIL_REPLY_TO` (variables). Los pasos completos están en
   [`PLAN-LOGISTICA.md` § 2.e](PLAN-LOGISTICA.md).
4. **Las pasarelas**, que ninguna aprueba un comercio sin dominio y sin páginas
   legales.

**La cuenta de Resend debería ser la definitiva** —la del negocio, no la de quien
desarrolla—: el día del traspaso, el dominio verificado del correo se queda donde
esté la cuenta.

---

## 7 · Lo que conviene dejar hecho antes de abrir al público

| Qué                                            | Por qué                                                                                                               |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Backups de Supabase con retención definida** | Un borrado accidental no tiene vuelta atrás                                                                           |
| **Cloudflare Access sobre el panel**           | Hoy la pantalla de acceso del panel es alcanzable por cualquiera que sepa la URL. RLS protege los datos, no la puerta |
| **Un plan de teselas del mapa**                | Hoy es CARTO sin clave; su cuota razonable no cubre una tienda abierta. Se cambia con `NEXT_PUBLIC_MAP_TILES_URL`     |
| **Las cuentas a nombre del negocio**           | Supabase, Cloudflare, Resend, Yappy y Meta. Lo que quede a nombre de otra persona se queda atrás en el traspaso       |

---

## 8 · Lo que queda del plan, y qué accesos pide cada cosa

Esta tabla existe para contestar de un vistazo «¿esto lo puedo hacer yo, o hace
falta algo que no tengo?». Ordenada por lo que desbloquea.

| Qué                                            | ¿Pide accesos?                 | Qué hace falta de verdad                                                                                                                                                           |
| ---------------------------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Los avisos por correo** (L2 2.e y L3)        | Sí, al final                   | El código se puede escribir hoy entero. Lo que espera es el **dominio verificado en Resend**, y por tanto el dominio. Los pasos, en [`PLAN-LOGISTICA.md` § 2.e](PLAN-LOGISTICA.md) |
| **La posición del motorizado en vivo** ([#29]) | Sí: una migración              | La migración está escrita en el issue. Con el MCP de Supabase es un `apply_migration`, y después `pnpm db:types`                                                                   |
| **El mapa de Despacho** ([#30])                | No, pero espera a una decisión | El plan de teselas (P1 número 4). No es una credencial: es elegir proveedor y pagarlo                                                                                              |
| **Las liquidaciones** ([#28])                  | No                             | Una respuesta de la dueña: cómo se le paga a un motorizado. Sin ella se construye la tabla equivocada                                                                              |
| **La fase L5**, couriers externos              | Sí, pero no tuyos              | Credenciales de Dropi PA o Servientrega. Hay que pedirlas fuera                                                                                                                    |
| **El Botón de Pago de Yappy**                  | Sí, pero no tuyos              | Su especificación, que no está publicada. Ver [`YAPPY.md`](YAPPY.md)                                                                                                               |
| **Cerrar el issue [#5]** (los tipos)           | Sí: mirar CI                   | Abrir el resumen del job de CI, leer el diff, y commitear el generado o escribir la migración que falte                                                                            |
| **La prueba del bucket privado**               | Sí: el panel abierto           | Subir una foto de entrega y comprobar que su enlace da 403 sin sesión. Paso 4 de este documento                                                                                    |

[#5]: https://github.com/juanarrietabusiness-pixel/tommalopty/issues/5

---

## Cómo pedirle esto a Claude Code

Si vas a hacerlo con una sesión de Claude Code con los conectores puestos, esto
ahorra la mitad del camino. **No hace falta explicarle el proyecto**: está
escrito. Basta con señalarle dónde.

**Lo primero que conviene decirle**, literal:

> Lee `docs/CONECTAR.md` y `docs/ESTADO.md` antes de tocar nada. Tengo los
> conectores de Supabase y Cloudflare puestos sobre el proyecto real.

A partir de ahí sabe el orden, las verificaciones y —lo que más vale— **lo que no
hay que hacer**, que está escrito porque ya salió caro.

**Qué herramienta corresponde a cada paso:**

| Paso                       | MCP de Supabase                    | MCP de Cloudflare                     |
| -------------------------- | ---------------------------------- | ------------------------------------- |
| Aplicar una migración      | `apply_migration`, **una por una** | —                                     |
| Ver qué hay aplicado       | `list_migrations`, `list_tables`   | —                                     |
| Comprobar permisos y datos | `execute_sql`                      | —                                     |
| Regenerar los tipos        | `generate_typescript_types`        | —                                     |
| Avisos de seguridad        | `get_advisors`                     | —                                     |
| Buckets de R2              | —                                  | `r2_buckets_list`, `r2_bucket_create` |
| Ver los Workers publicados | —                                  | `workers_list`, `workers_get_worker`  |

**Tres cosas que conviene decirle explícitamente**, porque son las que un
asistente no puede adivinar y aquí cuestan caro:

1. **Que staging tiene datos reales.** Sin eso, un `db reset` es una sugerencia
   razonable. Con eso, no vuelve a proponerlo.
2. **Que revoque `anon` tabla por tabla y nunca con un bucle.** Un bucle dejó
   esta tienda once días sin catálogo, y la lección está en
   [`ESTADO.md` § 4](ESTADO.md).
3. **Que un aviso del linter es una pregunta, no una orden.** El paso 3 lleva la
   lista de los que hay que dejar como están, con su porqué. Revocarle el
   `execute` a `is_staff()` para dejar los advisors en verde tumbaría la tienda
   entera.

**Y lo que NO hay que darle:** ninguna credencial pegada en el chat. Los
conectores ya son el acceso; una clave escrita en una conversación se queda en
esa conversación.

**Al terminar la sesión**, si los conectores eran de una cuenta personal,
revócalos. Es lo mismo que se le pide a cualquiera que entre a una base de datos
que no es suya.

---

## Lo que sigue bloqueado fuera del código

Nada de esto se resuelve con accesos: hay que pedirlo.

| A quién                         | Qué                                                                                         | Desbloquea                                                |
| ------------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `integracionesdev@yappy.com.pa` | El **host** de la API de integración. La especificación trae `localhost:3000` como marcador | La conciliación automática de cobros                      |
| `botondepagoyappy@bgeneral.com` | La **especificación del Botón de Pago**                                                     | Cobrar con Yappy en el checkout                           |
| Dropi PA / Servientrega         | Credenciales y sandbox                                                                      | La fase L5, couriers externos                             |
| Quien conozca la ley panameña   | Revisar términos, privacidad, envíos y devoluciones                                         | Vender legalmente, y que una pasarela apruebe el comercio |

---

## Cuando termines

Actualiza [`ESTADO.md`](ESTADO.md) —la tabla de conexiones del punto 1 y la lista
de pendientes— y tacha las casillas del
[issue #23](https://github.com/juanarrietabusiness-pixel/tommalopty/issues/23).

El siguiente que llegue va a leer eso primero, igual que tú.
