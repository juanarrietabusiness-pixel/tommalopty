# El norte

Dónde estamos, hacia dónde vamos y qué decide cada siguiente paso.

Este documento se actualiza. Si algo aquí no coincide con la realidad del
código, es este documento el que está mal.

---

## Dónde estamos hoy

Se partió de un `index.html` de 711 líneas. Hoy hay una plataforma con dos
aplicaciones, siete paquetes compartidos, 34 tablas con seguridad a nivel de
fila y 174 tests automatizados.

**Funciona de punta a punta:** catálogo con filtros y búsqueda, ficha de producto
con variantes, carrito persistente, checkout que calcula precios en servidor,
pedidos con reserva de inventario, panel de cliente, panel administrativo con
CMS y CRM, y reportes.

**No se puede cobrar todavía.** Las cuatro pasarelas están preparadas con su
interfaz completa, pero sin implementar. Es el único bloqueante real para vender.

### Lo que la auditoría cambió

Una auditoría independiente sobre la primera entrega encontró fallos graves que
ya están corregidos. Vale la pena conocerlos porque explican decisiones actuales:

| Fallo                                                 | Consecuencia si no se detecta                      |
| ----------------------------------------------------- | -------------------------------------------------- |
| RLS es por fila, no por columna                       | Cualquier cliente podía hacerse superadministrador |
| Números de pedido secuenciales usados como credencial | Enumerar la URL exponía el histórico de compras    |
| El stock nunca se descontaba                          | La última unidad se vendía infinitas veces         |
| Pedido y líneas en dos escrituras sin transacción     | Pedidos fantasma ya contabilizados como venta      |
| Los límites de cupón nunca se registraban             | Un cupón de un solo uso servía siempre             |

Ninguno lo detectó la revisión manual. Los encontraron los tests contra base de
datos real y una lectura adversarial. Por eso la batería de tests no es un
adorno: es la única forma de que este código sobreviva a su propio crecimiento.

---

## Cómo se decide qué sigue

Por orden. Nada de la fase siguiente empieza si algo de la anterior está a medias.

### Fase A · Poder cobrar _(bloqueante)_

Sin esto no hay negocio, solo un catálogo bonito.

1. **Contratar pasarela.** Recomendación: PayPal (internacional) + Wompi o
   PagueloFacil (tarjetas locales). Stripe no opera en Panamá.
2. **Implementar el adaptador.** La interfaz y los pasos están documentados en
   cada archivo de `packages/integrations/src/payments/providers/`.
3. ~~**Verificar el importe en el webhook.**~~ Hecho. `WebhookVerification`
   exige ahora un campo `amount`, y el handler no marca un pedido como pagado si
   el importe o la divisa no cuadran con `orders.total`: lo registra como
   anómalo y lo deja pendiente. Al ser un campo requerido del contrato, un
   adaptador que no lo rellene no compila.
4. **Probar el flujo completo en sandbox**, incluidos reembolsos.

### Fase B · Poder operar

Sin esto se vende, pero cada pedido cuesta trabajo manual.

5. ~~**Emails transaccionales.**~~ Hecho. Tres avisos enganchados a los eventos
   reales: pedido recibido (al crearlo, desde el checkout), pago confirmado
   (desde el webhook, solo si el importe cuadra) y pedido enviado (al marcarlo
   desde el panel). Sin `RESEND_API_KEY` no se envía nada y nada falla: el
   pedido es el hecho, el correo es el aviso.
6. **Subida de imágenes desde el panel** a R2. Hoy hay que pegar URLs.
7. **Variantes múltiples desde el panel.** Hoy solo se gestiona la variante por
   defecto.
8. **Reembolsos desde el panel** (depende de la pasarela).

### Fase C · Poder crecer

Sin esto se opera, pero el crecimiento cuesta más de lo que debería.

9. **Rendimiento del catálogo.** La ISR declarada no se aplica: leer las cookies
   fuerza render dinámico en cada visita. Para páginas públicas hay que usar un
   cliente anónimo sin cookies.
10. **Consultas que escalen.** El filtro por categoría carga todos los IDs en
    memoria; los buscadores del panel no tienen índice; los informes agregan la
    tabla entera en cada carga. Detallado en la auditoría.
11. **Carritos abandonados.** Las tablas existen pero el carrito solo vive en el
    navegador, así que el embudo de conversión mostrará ceros y no hay
    recuperación posible.
12. **Sitemap particionado.** Uno solo se rompe pasados 50.000 productos.

### Fase D · Poder escalar el equipo

13. Auditoría del panel (la tabla existe, nadie escribe en ella).
14. Vistas materializadas para los informes.
15. Paginación por cursor.
16. Migrar la búsqueda a Meilisearch si el catálogo crece mucho.

---

## Las palancas de crecimiento

Lo que convierte visitas en ventas. Cada una con su estado real.

### Velocidad de página

Google usa Core Web Vitals como factor de posicionamiento, y cada segundo de
carga cuesta conversión.

- ✅ Fuentes servidas localmente, sin salto de tipografía
- ✅ CSS sin framework: ~25 KB, no 200 KB
- ✅ Grid de producto renderizado en servidor
- ⚠️ **La ISR no se está aplicando** (fase C, punto 9). Es la mayor mejora
  pendiente de rendimiento.
- 🔲 Optimización de imágenes al conectar R2
- 🔲 Presupuesto de rendimiento medido en CI (Lighthouse)

### SEO

- ✅ Renderizado en servidor, metadatos dinámicos, canónicas
- ✅ Datos estructurados de producto (precio y disponibilidad en el resultado
  de búsqueda)
- ✅ `sitemap.xml` y `robots.txt` generados del catálogo real
- ✅ Un `h1` por página, jerarquía correcta _(el catálogo no tenía; lo detectó
  un test)_
- 🔲 Blog (tablas listas, falta interfaz)
- 🔲 Datos estructurados de reseñas y migas de pan

### Accesibilidad

No es cumplimiento normativo: es mercado. Y el mismo trabajo mejora el SEO.

- ✅ **WCAG 2.1 AA verificado automáticamente** en portada, catálogo, carrito,
  checkout y acceso, en cada PR
- ✅ Navegación completa por teclado, con foco visible
- ✅ Paneles cerrados fuera del orden de tabulación
- ✅ Contraste 4.5:1 — el naranja de marca tiene variante accesible para texto
- 🔲 Auditoría con lector de pantalla real (automatizar detecta ~30 % de los
  problemas; el resto necesita una persona)

### Compra por impulso

- ✅ El drawer se abre solo al añadir, con subtotal visible
- ✅ El carrito sobrevive a recargas
- ✅ Badge de oferta y precio tachado
- ✅ Aviso de stock bajo en la ficha
- 🔲 Envío gratis con barra de progreso ("te faltan $12 para envío gratis")
- 🔲 Productos relacionados y venta cruzada en el carrito
- 🔲 Checkout en un paso para clientes recurrentes

### Publicidad y medición

- ✅ Meta Pixel + Conversions API con deduplicación por `event_id`
- ✅ Evento de compra solo cuando el pago se confirma _(antes se disparaba en
  cada recarga, inflando la atribución)_
- ✅ Captación de leads desde la newsletter
- 🔲 **Microsoft Clarity** — mapas de calor, grabaciones de sesión y detección
  de clics de frustración. Gratis y sin límite de sesiones
- 🔲 Google Analytics 4
- 🔲 Catálogo de productos para Meta Shopping (feed)

### Confianza

- ✅ El checkout dice explícitamente que la tienda no recibe datos de tarjeta
- ✅ Barra de confianza con envío, pago seguro, devoluciones y soporte
- 🔲 Reseñas de producto (tablas y moderación listas, falta interfaz)
- 🔲 Sellos de las pasarelas al contratarlas

---

## Riesgos abiertos

| Riesgo                               | Impacto                 | Qué lo contiene                                                      |
| ------------------------------------ | ----------------------- | -------------------------------------------------------------------- |
| No hay pasarela contratada           | No se puede vender      | Fase A                                                               |
| Sin backups verificados              | Pérdida total de datos  | Supabase Pro + prueba trimestral de restauración                     |
| Contenido y catálogo de demostración | No se puede lanzar      | Decisión de la clienta                                               |
| Un solo entorno                      | Se prueba en producción | Crear staging antes del lanzamiento                                  |
| Un único proveedor de hosting        | Dependencia             | El código no usa APIs propietarias ([ADR 0002](adr/0002-hosting.md)) |

---

## Cómo se mide que va bien

| Indicador                              | Dónde se ve              | Objetivo                        |
| -------------------------------------- | ------------------------ | ------------------------------- |
| CI en verde                            | GitHub Actions           | Siempre                         |
| Violaciones WCAG                       | Tests E2E                | Cero                            |
| Cobertura de tests en reglas de dinero | `packages/domain`        | 100 %                           |
| Tiempo de despliegue                   | Cloudflare               | < 5 min                         |
| Conversión de carrito                  | Panel → Reportes         | Medirla antes de fijar objetivo |
| Costo de infraestructura / ventas      | [`COSTOS.md`](COSTOS.md) | < 0,5 %                         |

---

## Lo primero que hay que decidir

Tres decisiones de negocio, no técnicas, que hoy bloquean el avance:

1. **Qué pasarelas se contratan.** Bloquea todo lo demás.
2. **Marca, catálogo y textos reales.** Hoy la tienda muestra los marcadores de
   posición del esqueleto.
3. **Dominio y cuenta de Cloudflare**, para levantar staging y empezar a probar
   de verdad.
