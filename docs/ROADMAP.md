# Roadmap y estado

> **El objetivo actual es la estructura completa y desplegada**, no vender.
> La pasarela de pago se conecta cuando la aplicación esté terminada, y su
> elección es de la dueña de la plataforma:
> [ADR 0006](adr/0006-pasarela-al-final.md). Lo que queda marcado abajo como
> pendiente y **no** depende de la pasarela es lo que manda.

## Fase 1 — MVP de tienda pública ✅

- [x] Catálogo con categorías, filtros, orden y paginación
- [x] Ficha de producto con variantes, stock y SEO (SSG + ISR)
- [x] Búsqueda full-text en español
- [x] Carrito persistente (drawer + página completa)
- [x] Checkout desacoplado de la pasarela
- [x] Confirmación de pedido
- [ ] **Pago real** — adaptadores preparados; en espera de decisión de negocio (ADR 0006)

## Fase 2 — Panel de cliente ✅

- [x] Registro e inicio de sesión (Supabase Auth)
- [x] Historial y detalle de pedidos
- [x] Direcciones guardadas
- [x] Wishlist / favoritos
- [ ] Edición de datos personales desde el panel de cliente

## Fase 3 — Panel administrativo ✅

- [x] Dashboard con KPIs y ventas por día
- [x] CRUD de productos (precio, stock, SEO, estado)
- [x] Categorías e inventario con ajuste en línea
- [x] Pedidos: estados, bitácora y notas internas
- [x] CRM: fichas, historial, notas privadas y etiquetas
- [x] Descuentos
- [x] CMS: banners de portada y páginas estáticas
- [x] Reportes: ventas, más vendidos, reposición, embudo
- [x] Usuarios y roles
- [x] Configuración de integraciones
- [x] Recorrido de demostración: el panel se navega entero sin base de datos
- [x] **Editor de menús** — las tres zonas se editan en `/contenido/menus`
- [ ] **Gestión de variantes múltiples** desde el panel (hoy: variante por defecto)
- [ ] **Subida de imágenes** a R2 / Supabase Storage desde el panel
- [ ] **Blog** (`cms_posts` existe, falta la interfaz)
- [ ] **Reseñas** (`reviews` existe con moderación, falta la interfaz)
- [ ] **Campañas** (`campaigns` existe, falta la interfaz)
- [ ] Reembolsos desde el panel — en espera de la pasarela (ADR 0006)

## Fase 4 — Marketing 🔶

- [x] Meta Pixel en cliente
- [x] Conversions API en servidor, con deduplicación por `event_id`
- [x] Captación de leads desde la newsletter
- [x] Email transaccional: proveedor y plantillas
- [x] Emails enganchados a los eventos de pedido (recibido, pagado, enviado)
- [ ] Campañas y segmentación desde el panel (tablas listas)
- [ ] Google Analytics 4

## Fase 5 — Escalado 🔲

- [x] Caducidad de las reservas de stock (`caducar_reservas_de_pedidos`)
- [ ] Reserva de stock durante el checkout, antes de crear el pedido
- [ ] Recuperación de carritos abandonados
- [ ] Migrar la búsqueda a Meilisearch si el catálogo crece
- [ ] Tests end-to-end del flujo de compra
- [ ] Auditoría completa del panel (la tabla `audit_log` ya existe)

---

## Fase 6 — Logística y trazabilidad 🔲

Planificada en detalle en [`PLAN-LOGISTICA.md`](PLAN-LOGISTICA.md), a partir de
las preguntas de la clienta. Nada de esto existe todavía.

- [ ] Direcciones con mapa y coordenadas (el pin, no el texto, manda)
- [ ] Envíos como entidad propia, con guía y línea de tiempo
- [ ] Guía de despacho en PDF con QR que abre Waze y Google Maps
- [ ] Página pública de seguimiento del pedido
- [ ] Abonos: pagos parciales y despacho condicionado al saldo
- [ ] Motorizados: rol, app PWA, asignación, rutas y liquidaciones
- [ ] Couriers externos (Servientrega, Droppy) como adaptadores

## Lo primero que hay que decidir

1. **Dominio y cuenta de Cloudflare**, para desplegar. Es lo único que bloquea
   hoy y lo único que no se resuelve escribiendo código.

La pasarela y el catálogo real ya no bloquean: ver
[ADR 0006](adr/0006-pasarela-al-final.md) y `docs/PLAN.md`.
