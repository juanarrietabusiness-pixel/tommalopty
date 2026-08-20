# Roadmap y estado

## Fase 1 — MVP de tienda pública ✅

- [x] Catálogo con categorías, filtros, orden y paginación
- [x] Ficha de producto con variantes, stock y SEO (SSG + ISR)
- [x] Búsqueda full-text en español
- [x] Carrito persistente (drawer + página completa)
- [x] Checkout desacoplado de la pasarela
- [x] Confirmación de pedido
- [ ] **Pago real** — los adaptadores están preparados, falta implementarlos

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
- [ ] Gestión de variantes múltiples desde el panel (hoy: variante por defecto)
- [ ] Subida de imágenes a R2 / Supabase Storage desde el panel
- [ ] Reembolsos desde el panel (depende de la pasarela)
- [ ] Blog (las tablas existen, falta la interfaz)

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

## Lo primero que hay que decidir

1. **Qué pasarelas se contratan.** Sin eso no se puede cobrar. Es el único
   bloqueante real para vender.
2. **Marca y catálogo reales.** Hoy la tienda muestra el contenido de
   marcador de posición del esqueleto.
3. **Dominio y cuenta de Cloudflare**, para levantar staging.
