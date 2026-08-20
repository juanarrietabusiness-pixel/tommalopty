# Brief técnico original

> Documento de partida entregado por el cliente, versionado aquí como
> referencia. Las decisiones que se tomaron a partir de él —y las que se
> desviaron— están explicadas en [`ARQUITECTURA.md`](ARQUITECTURA.md).
>
> Vigencia de los datos del brief: agosto 2026.

## 1. Contexto y alcance

Tienda online pensada para crecer hacia una plataforma e-commerce completa
mantenida por varios programadores. Partía de un esqueleto de front-end estático
(`index.html`) con header, hero, grid de catálogo, carrito y footer, como
referencia visual y estructural.

Fases previstas:

1. MVP tienda pública: catálogo, ficha, carrito, checkout, pago, confirmación.
2. Panel de cliente: cuenta, pedidos, direcciones, wishlist.
3. Panel administrativo: catálogo, pedidos, CRM, descuentos, reportes, CMS.
4. Integraciones de marketing: Meta Pixel + Conversions API, email, remarketing.
5. Escalado: multi-usuario admin con roles, auditoría, performance.

## 2. Stack acordado

| Capa          | Elección                                                             |
| ------------- | -------------------------------------------------------------------- |
| Frontend      | Next.js (React) + TypeScript                                         |
| Hosting/CDN   | Cloudflare (egress $0 con R2, DNS/CDN/seguridad del mismo proveedor) |
| BD + Auth     | Supabase (Postgres) con Row Level Security                           |
| Storage       | Cloudflare R2 o Supabase Storage                                     |
| CMS           | Tablas propias en Supabase, gestionadas desde el panel               |
| CRM           | Tablas propias en Supabase                                           |
| Búsqueda      | Full-text de Postgres; migrar a Meilisearch/Algolia si crece         |
| Email         | Resend o Postmark                                                    |
| Ads/Analytics | Meta Pixel + Conversions API + GA4                                   |

## 3. Pasarela de pago

Stripe no opera con comercios domiciliados en Panamá (su cobertura en
Latinoamérica se limita a Brasil y México). Opciones reales: PayPal Checkout,
Wompi (Banistmo), PagueloFacil, Yappy (Banco General), y pasarelas bancarias
tradicionales (CROEM, BAC Credomatic, Credicorp).

Recomendación de arranque: **PayPal + Wompi o PagueloFacil**, con el checkout
desacoplado en el backend para poder añadir o quitar pasarelas sin rehacer el
frontend.

Detalle y estado de implementación: [`PAGOS-PANAMA.md`](PAGOS-PANAMA.md).

## 4. Roles y permisos

- **Visitante**: navega catálogo, arma carrito (sin cuenta).
- **Cliente registrado**: checkout, historial, direcciones, wishlist.
- **Admin/operador**: catálogo, pedidos, clientes, descuentos, CMS.
- **Superadmin**: usuarios admin, integraciones, reportes financieros.

Implementado con Supabase Auth + RLS por rol desde el día uno.

## 5. Módulos funcionales

**Tienda pública** — catálogo con categorías y filtros, ficha con variantes e
imágenes, carrito persistente, checkout, páginas de contenido, blog opcional.

**Panel de cliente** — registro/login, historial y estado de pedidos,
direcciones, wishlist, datos personales.

**Panel administrativo** — CRUD de catálogo, gestión de pedidos, CRM,
CMS, reportes, usuarios y roles, configuración de integraciones.

**Integraciones** — Meta Pixel + Conversions API, webhooks de pasarelas, email
transaccional.

## 6. Modelo de datos inicial

`users`, `roles`, `customers`, `products`, `product_variants`, `categories`,
`inventory`, `discounts`, `carts`, `cart_items`, `orders`, `order_items`,
`payments`, `addresses`, `shipping_methods`, `reviews`, `cms_pages`,
`cms_banners`, `leads`, `crm_notes`.

Implementado en `supabase/migrations/`, con algunas tablas añadidas sobre el
listado original: `profiles`, `product_images`, `product_options`,
`product_categories`, `order_events`, `payment_webhook_events`,
`discount_redemptions`, `wishlists`, `cms_posts`, `cms_menus`, `settings`,
`integrations`, `campaigns`, `crm_tags`, `audit_log`.

## 7. Requisitos no funcionales

- **Seguridad de pagos**: nunca almacenar datos de tarjeta; usar los SDK
  oficiales de cada pasarela (tokenización). El cumplimiento PCI-DSS recae en el
  proveedor.
- **RLS desde el inicio**, para separar datos por rol y por cliente.
- **Entornos separados** (dev / staging / producción) con credenciales propias.
- **CI/CD** con lint y tests antes de desplegar.
- **SEO**: SSR/ISR en fichas y categorías, sitemap, metadatos dinámicos.
- **Moneda**: USD (Panamá usa dólar americano).
- **Backups** automáticos de Supabase con política de retención definida.

## 8. Convenciones de equipo

Monorepo con apps separadas (`apps/storefront`, `apps/admin`) y paquetes
compartidos (`packages/ui`, `packages/db`). TypeScript estricto, ESLint +
Prettier, Conventional Commits, README por módulo y diagrama de arquitectura
actualizado.

## Fuentes consultadas por el cliente

- Stripe — global availability
- Pasarelas de pago para e-commerce en Panamá (Jootser)
- Cloudflare Pages vs Netlify 2026
