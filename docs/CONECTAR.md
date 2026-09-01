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

---

## 3 · Mirar los avisos de seguridad de Supabase

**Por qué:** el linter de Supabase mira la base ya aplicada, no el SQL, y por eso
ve cosas que la revisión de código no. Encontró dos fallos reales en este
proyecto (migración 0020): un `revoke ... from anon` que no revocaba nada, y
funciones de disparador expuestas como endpoints REST.

Panel del proyecto → **Advisors → Security**. Con el MCP: `get_advisors`.

Hacerlo **después** de aplicar las migraciones, no antes: lo que interesa es lo
que digan de las tablas nuevas.

---

## 4 · Crear el bucket privado de R2

**Qué desbloquea:** la foto de la prueba de entrega y el comprobante del abono.
El código ya escribe y lee de él; mientras no exista, subir avisa con un mensaje
claro y no rompe nada.

```bash
wrangler r2 bucket create nebula-media-privada
```

Con el MCP de Cloudflare: `r2_bucket_create`.

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
