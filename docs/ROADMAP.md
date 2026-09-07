# Roadmap y estado

> Esto es el plan por fases. El estado **real** de lo publicado, con los fallos
> abiertos y lo que falta configurar, está en [`ESTADO.md`](ESTADO.md).

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
- [x] Edición de datos personales desde el panel de cliente (`/cuenta/datos`)

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
- [x] **Gestión de variantes múltiples** desde el panel (talla y color ya son vendibles)
- [x] **Subida de imágenes** a Cloudflare R2 desde el panel (banner y galería de producto)
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
- [~] Tests end-to-end del flujo de compra — el embudo entero está cubierto
  (portada, catálogo, ficha, carrito, checkout, mapa y totales del servidor);
  lo que falta es la compra **cerrada**, y falta porque no hay pasarela que
  cobrar
- [ ] Auditoría completa del panel (la tabla `audit_log` ya existe)

---

## Fase 6 — Logística y trazabilidad 🔶

Planificada en detalle en [`PLAN-LOGISTICA.md`](PLAN-LOGISTICA.md), a partir de
las preguntas de la clienta. **Casi toda está construida**: hasta el 6 de
septiembre este apartado decía «nada de esto existe todavía», y llevaba meses
siendo falso.

- [x] Direcciones con mapa y coordenadas (el pin, no el texto, manda) — **L1**
- [x] Envíos como entidad propia, con guía y línea de tiempo — **L2**
- [x] Guía de despacho imprimible en 4×6" con QR que abre Waze y Google Maps — **L2**
- [x] Página pública de seguimiento del pedido, sin cuenta y con token opaco — **L2**
- [x] Abonos: pagos parciales y despacho condicionado al saldo, con tres
      políticas y un disparador que las hace cumplir — **L3**
- [x] Motorizados: rol, ficha, app en la tienda, pantalla de despacho con
      asignación sugerida y orden de ruta — **L4.1 y casi L4.2**
- [ ] **Posición del motorizado en vivo** — lo único de L4.2 que pide migración
      ([#29](https://github.com/juanarrietabusiness-pixel/tommalopty/issues/29))
- [ ] **Liquidaciones de motorizados** — bloqueadas por una decisión de negocio,
      no por código: cómo se le paga a quien reparte ([#28](https://github.com/juanarrietabusiness-pixel/tommalopty/issues/28))
- [ ] **Mapa de la pantalla de Despacho** — detrás del plan de teselas
      ([#30](https://github.com/juanarrietabusiness-pixel/tommalopty/issues/30))
- [ ] **Couriers externos** (Dropi PA, Servientrega) como adaptadores — **L5**.
      La investigación técnica está hecha en
      [`INVESTIGACION-COURIERS-PANAMA.md`](INVESTIGACION-COURIERS-PANAMA.md);
      falta contrato y credenciales, que no se resuelven programando

## Lo primero que hay que decidir

1. **Dominio propio.** La cuenta de Cloudflare ya está y staging publica desde
   ella; lo que falta es el dominio, y con él se desbloquean Resend (necesita
   dominio verificado para enviar), R2 fuera de `r2.dev`, y la revisión de
   cualquier pasarela —ninguna aprueba un comercio en `workers.dev`—. No
   desbloquea programación: hace que corra código ya escrito.
2. **Qué pasarela se contrata, y en qué orden.** Los cuatro adaptadores existen
   con su interfaz y su documentación, pero **ninguno cobra todavía**
   ([#3](https://github.com/juanarrietabusiness-pixel/tommalopty/issues/3)). Mientras eso siga así, la estructura está terminada y el
   negocio no ha empezado.

> **Sobre el orden, dicho claro.** El [ADR 0006](adr/0006-pasarela-al-final.md)
> decidió dejar la pasarela para el final, y fue la decisión correcta: permitió
> construir el checkout sin atarlo a ningún proveedor. Pero «al final» ya llegó.
> Hoy la pasarela no es lo último de la lista: es lo único que separa una
> plataforma completa de una tienda que vende.
