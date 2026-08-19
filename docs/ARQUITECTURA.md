# Arquitectura

## Visión general

```
                 ┌──────────────────────────────────────────┐
                 │            Cloudflare (CDN/WAF)          │
                 └───────────────┬──────────────┬───────────┘
                                 │              │
                   ┌─────────────▼───┐    ┌─────▼───────────┐
                   │  storefront     │    │  admin          │
                   │  Next.js 16     │    │  Next.js 16     │
                   │  SSR/ISR        │    │  SSR + Actions  │
                   └────┬───────┬────┘    └────────┬────────┘
                        │       │                  │
             anon key   │       │ service role     │ anon key
             (RLS)      │       │ (webhooks,       │ (RLS)
                        │       │  pedidos)        │
                   ┌────▼───────▼──────────────────▼────────┐
                   │        Supabase (PostgreSQL)           │
                   │  Auth · RLS · catálogo · CRM · CMS     │
                   └────────────────────────────────────────┘
                        │                          │
              ┌─────────▼─────────┐     ┌──────────▼─────────┐
              │ Pasarelas de pago │     │ Meta CAPI · Resend │
              │ PayPal · Wompi …  │     │ (marketing/email)  │
              └───────────────────┘     └────────────────────┘
```

## Decisiones y por qué

### Monorepo con dos apps

`storefront` y `admin` son aplicaciones separadas, no rutas de la misma app.
Motivos concretos:

- El panel nunca debe indexarse ni compartir superficie pública con la tienda.
- Sus perfiles de caché son opuestos: la tienda vive de ISR y contenido
  estático; el panel es 100 % dinámico.
- Permite repartir el trabajo entre varios programadores sin pisarse.

Lo que sí comparten (diseño, acceso a datos, integraciones) vive en `packages/`.

### La seguridad vive en la base de datos, no en la interfaz

Row Level Security está activo en las 34 tablas desde la primera migración.
Las reglas de acceso se expresan una sola vez, en SQL, y valen para cualquier
cliente que se conecte:

| Rol             | Puede                                                    |
| --------------- | -------------------------------------------------------- |
| `anon`          | Solo catálogo y CMS publicados                           |
| `authenticated` | Además, **sus** pedidos, direcciones, carrito y wishlist |
| `operator`      | Lectura del panel                                        |
| `admin`         | Escritura del panel (catálogo, pedidos, CRM, CMS)        |
| `superadmin`    | Usuarios admin e integraciones                           |
| `service_role`  | Salta RLS — reservado a servidor                         |

Consecuencia práctica: el panel usa el cliente ligado a la sesión del operador,
**no** el de service-role. Si la interfaz ofreciera por error un botón que su
rol no permite, la base de datos lo rechaza igualmente.

El `service_role` se usa solo donde no existe una sesión que pueda autorizar la
operación:

- webhooks de las pasarelas de pago,
- creación de pedidos (incluye compras de invitado),
- alta de leads desde la newsletter.

### Los precios se recalculan siempre en servidor

`/api/checkout` ignora los importes que manda el navegador: solo acepta qué
variante y cuántas unidades. Lee los precios del catálogo, valida el stock y
calcula el descuento con la función `validate_discount` de Postgres — la misma
que usa el panel, para que tienda y administración nunca diverjan.

Los códigos de descuento no son legibles públicamente: RLS los oculta y la
validación pasa por una función `SECURITY DEFINER` que solo devuelve el importe.
Así nadie puede enumerar los códigos activos.

### El estado del pago lo decide el webhook

Nunca se marca un pedido como pagado desde la vuelta del navegador, que es
manipulable. La confirmación llega por webhook, con firma verificada, y cada
evento se guarda en `payment_webhook_events` con índice único
`(provider, event_id)`: los reintentos de la pasarela no reprocesan nada.

### Pasarelas intercambiables

El checkout habla con una sola interfaz (`PaymentProvider`). Qué pasarelas se
ofrecen lo decide `PAYMENTS_ENABLED_PROVIDERS`, una variable de entorno.
Activar Yappy en producción no toca ni una línea del frontend.

Ver [`PAGOS-PANAMA.md`](PAGOS-PANAMA.md) para el detalle de por qué no se usa
Stripe.

### CMS y CRM propios

Tablas en Supabase gestionadas desde el panel, en lugar de un CMS externo. El
objetivo del proyecto es tener panel propio, y añadir una dependencia externa
para editar tres banners no compensa. Si más adelante hiciera falta algo más
potente, Payload o Directus se conectan al mismo Postgres sin migrar datos.

### Tipos de base de datos generados, no escritos a mano

`packages/db/src/generated/database.types.ts` refleja el esquema real: 34
tablas, 5 vistas, 12 enums y las relaciones de claves foráneas (que es lo que
permite tipar los `select` anidados). Se regenera con `pnpm db:types`; no se
edita a mano.

## Flujo de una compra

1. El visitante añade al carrito. El carrito vive en `localStorage`
   (`CartProvider`), así que sobrevive a recargas sin exigir cuenta.
2. En `/checkout` elige envío y pasarela. El formulario no conoce ninguna
   integración: solo envía a `/api/checkout`.
3. El servidor recalcula precios, valida stock y descuento, crea el pedido con
   `service_role` y llama a la pasarela elegida.
4. Si la pasarela devuelve una URL, se redirige. Si no está conectada todavía,
   el pedido queda registrado como pendiente y se avisa con claridad — nunca se
   finge un pago.
5. La pasarela confirma por webhook. Ahí se marca el pedido como pagado, y los
   triggers de la base de datos actualizan las métricas del cliente y la
   bitácora del pedido.
6. La página de confirmación emite el evento `Purchase` a la Conversions API.

## Rendimiento y SEO

- Fichas de producto y páginas del CMS: SSG con `generateStaticParams` + ISR.
- Portada: ISR de 5 minutos, para que un cambio de banner se publique sin
  desplegar.
- Carrito, checkout y área de cuenta: dinámicos y marcados `noindex`.
- Metadatos dinámicos, datos estructurados de producto (`schema.org/Product`),
  `sitemap.xml` y `robots.txt` generados desde el catálogo real.

## Qué falta

Ver [`ROADMAP.md`](ROADMAP.md).
