# 0007 · El media vive en Cloudflare; Supabase se queda con datos y cuentas

**Estado:** aceptada · agosto 2026

## Contexto

Había una contradicción sin resolver en el repositorio. El
[ADR 0002](0002-hosting.md) dice que las imágenes del catálogo se sirven desde
Cloudflare R2. Pero `supabase/config.toml` declara dos buckets de Supabase
Storage —`product-images` y `cms-media`— y el paso 0.2 del plan («subida de
imágenes») los iba a usar por inercia, simplemente porque estaban escritos ahí.

Nadie había tomado la decisión: estaban las dos opciones a la vez, y ganaba la
que se implementara primero.

Se suma que la plataforma no va a servir solo fotos de producto. El plan de
logística añade fotos de prueba de entrega, y la dueña quiere subir también
video. Eso cambia el orden de magnitud del problema: no es lo mismo un catálogo
de imágenes que una biblioteca de video.

Y hay un hecho de contexto que decide: **la cuenta de Cloudflare ya está pagada
y en uso.** Los dos Workers (`nebula-storefront` y `nebula-admin`) existen desde
el 21 de agosto de 2026.

## Decisión

**Todo lo que se sirve al navegador vive en Cloudflare. Supabase se queda
únicamente con la base de datos y las cuentas de usuario.**

| Pieza                                  | Dónde vive                                               |
| -------------------------------------- | -------------------------------------------------------- |
| Las dos aplicaciones                   | Cloudflare Workers                                       |
| Imágenes de catálogo y CMS             | Cloudflare R2                                            |
| Transformaciones y variantes de imagen | Cloudflare Images                                        |
| Video                                  | Cloudflare Stream (o R2, si basta con servir el archivo) |
| Fotos de prueba de entrega             | R2, en bucket privado con URL firmada                    |
| Guías en PDF y códigos QR              | Generados en el Worker, servidos desde R2                |
| CDN, WAF, DNS, Access                  | Cloudflare                                               |
| **Base de datos, RLS, autenticación**  | **Supabase**                                             |

Los buckets de Supabase Storage declarados en `supabase/config.toml` se retiran.
Es el primer paso de implementación del paso 0.2, no un cambio aparte.

## Por qué el media sí

**El egress es gratis y el almacenamiento es barato.** R2 da 10 GB al mes
gratis, y a partir de ahí $0,015 por GB-mes, con transferencia de salida a coste
cero. El plan gratuito de Supabase da 1 GB de storage y sí cobra transferencia.
Para un catálogo con fotos —y más aún con video— la diferencia no está en el
almacenamiento, está en la salida: es exactamente el mismo argumento que ya
decidió el hosting en el ADR 0002, aplicado al archivo en lugar de al HTML.

**Supabase Storage no es una plataforma de video, y Stream sí.** Servir video
bien no es guardar un MP4: es transcodificar a varias calidades, adaptar el
bitrate a la conexión de quien mira y entregarlo desde un reproductor que sepa
hacerlo. Stream hace eso con una llamada a su API. Sobre Supabase Storage habría
que construirlo, o servir un archivo único y aceptar que en una conexión móvil
mala no se ve.

**Un solo lugar donde mirar.** Facturación, métricas de tráfico, reglas de caché
y control de acceso del media pasan a estar donde ya están las del sitio.

## Por qué la base de datos no

La pregunta legítima que sigue es si también la base de datos puede mudarse, y
que todo viva en Cloudflare de verdad. La respuesta es que **se puede, y no
conviene** — y el motivo no es la potencia de Cloudflare, es lo que este
proyecto ya construyó encima de Postgres.

**La seguridad de esta plataforma vive en la base de datos, no en la
aplicación.** Es el [ADR 0003](0003-seguridad-en-la-base-de-datos.md), y no fue
una preferencia estética: la auditoría encontró que un cliente podía hacerse
superadministrador, y lo que lo arregló fueron políticas RLS. D1 es SQLite y
**no tiene seguridad a nivel de fila**. Mudarse significaría reescribir las
políticas de 34 tablas como comprobaciones en código de aplicación — es decir,
deshacer a mano precisamente la corrección que la auditoría obligó a hacer, y
volver al modelo donde un olvido en una consulta expone datos de otro cliente.

**El pedido se crea dentro de una función transaccional de Postgres.** Es el
[ADR 0004](0004-pedidos-transaccionales.md). `create_order` valida catálogo y
stock, bloquea inventario, reserva unidades, calcula totales y registra el canje
del cupón: todo o nada. Está escrita en plpgsql, que SQLite no tiene. Antes de
existir, había pedidos fantasma y la misma unidad se vendía dos veces.

**Las cuentas de los clientes son Supabase Auth.** Cloudflare Access protege
equipos internos, no es un sistema de registro, contraseñas y recuperación para
compradores. Mudarse obligaría a construirlo o a contratar un tercer proveedor —
con lo que «todo en Cloudflare» dejaría de ser cierto igual.

**La búsqueda en español es full-text de Postgres**, con su diccionario y sus
índices. En SQLite habría que rehacerla.

**Y los límites no ayudan.** D1 incluye 5 GB de almacenamiento y cobra $0,75 por
GB-mes adicional; Supabase Pro incluye 8 GB por los $25 del plan, que además
cubren backups, autenticación y storage.

En resumen: mudar la base de datos es semanas de trabajo cuyo resultado es una
plataforma **menos** segura y con menos funciones, para ahorrar un proveedor.
El media es justo lo contrario: se gana rendimiento y se ahorra dinero.

## Lo que se acepta a cambio

**Siguen siendo dos proveedores.** «Todo en Cloudflare» no se cumple del todo, y
conviene decirlo con claridad en vez de venderlo. Lo que sí se cumple es que
Cloudflare sirve el 100 % de lo que llega al navegador, y Supabase queda como
una dependencia de datos que ningún visitante toca directamente.

**Hay que habilitar R2 en la cuenta.** Hoy no lo está: la API responde
`Please enable R2 through the Cloudflare Dashboard`. Es una activación en el
panel, sin coste hasta pasar el nivel gratuito, pero bloquea el paso 0.2 hasta
que se haga.

**Las fotos de prueba de entrega no pueden ser públicas.** Llevan la puerta de
la casa de un cliente. Van en bucket privado y se sirven con URL firmada de
caducidad corta, no con enlace directo — a diferencia de las fotos de catálogo.

**El desarrollo local pierde una comodidad.** Supabase local levanta su storage
con `pnpm db:start`; R2 no vive en ese Docker. Se resuelve apuntando el entorno
de desarrollo a un bucket de pruebas, o con el emulador local de R2 de wrangler.

## Cuándo reconsiderar

Si Cloudflare llegara a ofrecer Postgres gestionado con seguridad a nivel de
fila y autenticación de usuarios finales, la comparación cambia y vale la pena
rehacerla. Hyperdrive —que acelera conexiones a un Postgres externo desde
Workers— no cambia nada de esto, porque el problema nunca fue la latencia de
conexión; si en algún momento lo fuera, se evalúa aparte y sin mover de sitio la
base de datos.

Si en algún momento el video pasa a ser el producto y no un complemento,
conviene medir Stream contra alternativas antes de comprometerse a volumen.
