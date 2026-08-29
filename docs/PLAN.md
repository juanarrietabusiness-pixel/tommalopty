# El norte

Dónde estamos, hacia dónde vamos y qué decide cada siguiente paso.

Este documento se actualiza. Si algo aquí no coincide con la realidad del
código, es este documento el que está mal.

---

## El objetivo, en una frase

**Tener la plataforma completa y desplegada: tienda, panel y CMS terminados, con
toda la estructura lista para enchufar lo que falte.**

Que no haya catálogo real ni métodos de pago activos no lo impide. Cobrar es un
paso posterior, y su momento y su proveedor los decide la dueña de la plataforma
([ADR 0006](adr/0006-pasarela-al-final.md)).

Esto invierte el orden que tenía este documento. Antes abría con "Fase A · Poder
cobrar (bloqueante)"; ahora esa fase espera, y lo que manda es terminar lo que no
existe.

---

## Dónde estamos hoy

Se partió de un `index.html` de 711 líneas. Hoy hay una plataforma con dos
aplicaciones, siete paquetes compartidos, 34 tablas con seguridad a nivel de
fila y 174 tests automatizados.

**Funciona de punta a punta:** catálogo con filtros y búsqueda, ficha de producto
con variantes, carrito persistente, checkout que calcula precios en servidor,
pedidos con reserva de inventario, panel de cliente, panel administrativo con
CMS y CRM, y reportes.

**No se puede cobrar todavía, y es deliberado.** Las cuatro pasarelas están
preparadas con su interfaz completa, sin implementar. No bloquea el objetivo
actual: se conectan al final, cuando la dueña decida proveedor
([ADR 0006](adr/0006-pasarela-al-final.md)).

**Lo que sí bloquea es el panel a medias.** Hay cinco tablas cuyo contenido no se
puede editar desde ninguna pantalla: menús, blog, reseñas y campañas no tienen
interfaz, y las imágenes de producto se pegan como URL en vez de subirse. Ahí
está el trabajo.

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

Por orden. Nada de la fase siguiente empieza si algo de la anterior está a
medias. La fase 0 va primero; la A espera a que la dueña decida contratar.

### Fase 0 · Estructura completa y desplegada _(lo que manda hoy)_

Terminar lo que no existe y ponerlo en un entorno real. Nada de esto necesita
pasarela, catálogo real ni contenido definitivo.

**Panel y CMS, lo que falta por construir:**

0.1 ~~**Editor de menús.**~~ Hecho. Las tres zonas —cabecera, pie/tienda y
pie/ayuda— se editan en `/contenido/menus`: añadir, reordenar y borrar enlaces
sin tocar SQL. La validación de las URL vive en `@nebula/domain` porque es de
seguridad, no de formulario: lo que se guarda aquí acaba en un `href` de la
tienda, así que un `javascript:` se ejecutaría en el navegador de cada
visitante. Se aceptan rutas internas, http(s), `mailto:` y `tel:`, y nada más.
0.2 ~~**Subida de imágenes.**~~ Hecho, y en Cloudflare R2 en vez de Supabase
Storage: había dos opciones escritas a la vez y las cerró el
[ADR 0007](adr/0007-media-en-cloudflare.md). Se sube desde el banner de portada
y desde la galería de producto —que antes no existía: `product_images` estaba
sin ninguna pantalla que escribiera en ella—. Se usa el _binding_ de R2, así que
no hay credenciales que guardar. La validación no se fía del `Content-Type` que
manda el navegador: lee los primeros bytes del fichero. Falta configurar
`NEXT_PUBLIC_R2_PUBLIC_URL` en cada entorno; sin él, el panel se niega a subir en
vez de guardar una imagen que nadie podría ver.
0.3 **Variantes múltiples.** Hoy solo se gestiona la variante por defecto, así
que talla y color no son vendibles.
0.4 **Blog.** `cms_posts` existe sin ninguna pantalla.
0.5 **Reseñas.** `reviews` existe con estados de moderación y sin moderador.
0.6 **Campañas.** `campaigns` existe sin interfaz.
0.7 **Datos personales del cliente.** El panel de cliente muestra pedidos,
direcciones y favoritos, pero no deja editar nombre ni teléfono.

**Despliegue:**

0.8 **Secretos de Cloudflare** y primer despliegue de los dos Workers.
0.9 **Entorno de staging** con la base ya creada, y el historial de migraciones
reconciliado.
0.10 **Páginas legales completadas** y revisadas. Hacen falta para publicar,
independientemente del pago.

### Fase A · Poder cobrar _(en espera de decisión de negocio)_

No es bloqueante del objetivo actual. Arranca cuando la dueña de la plataforma
decida proveedor — ver [ADR 0006](adr/0006-pasarela-al-final.md). Se conserva
entero para ese momento.

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
6. Subida de imágenes y 7. variantes múltiples se adelantan a la **fase 0**:
   son estructura del panel, no operación de venta.
7. **Reembolsos desde el panel.** Se queda aquí: depende de la pasarela, así que
   espera con ella.

### Fase C · Poder crecer

Sin esto se opera, pero el crecimiento cuesta más de lo que debería.

9. ~~**Rendimiento del catálogo.**~~ Hecho, y el alcance era mayor de lo
   detectado: no eran las cuatro rutas con `revalidate`, era toda la tienda. La
   capa de datos compartida —marca, menús, banners— la usa el layout, así que
   `/`, `/carrito`, `/entrar`, `/buscar`, `/sitemap.xml` y hasta el 404 se
   renderizaban en cada visita. Con el cliente anónimo sin cookies
   (`getSupabaseAnonClient`), portada y sitemap son estáticos, y ficha de
   producto y páginas de CMS se prerenderizan. `/tienda` sigue dinámica, pero
   por leer `searchParams`, que es legítimo. Un paso de CI falla si alguna
   página vuelve a perder su prerenderizado.
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
- ✅ **Portada y sitemap estáticos; ficha de producto y páginas de CMS
  prerenderizadas.** Antes cada visita llegaba a Postgres, incluido el 404
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
| No hay pasarela contratada           | No se puede vender aún  | Aplazado a propósito ([ADR 0006](adr/0006-pasarela-al-final.md))     |
| Sin backups verificados              | Pérdida total de datos  | Supabase Pro + prueba trimestral de restauración                     |
| Contenido y catálogo de demostración | No impide desplegar     | Se sustituye cargando datos, sin tocar código                        |
| Páginas legales sin revisar          | La pasarela no aprueba  | Borradores listos; falta completar datos y revisión legal en Panamá  |
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

Una sola cosa bloquea hoy, y no es la pasarela:

1. **Dominio y cuenta de Cloudflare.** Sin esto no hay despliegue, y sin
   despliegue no hay "en producción". Es lo único de la fase 0 que no depende de
   escribir código.

Lo demás ya no bloquea:

- **La pasarela espera** a que la aplicación esté completa, y la elige la dueña
  de la plataforma ([ADR 0006](adr/0006-pasarela-al-final.md)).
- **La marca y el catálogo reales** pueden entrar después. La plataforma se
  despliega y se enseña con contenido de demostración; sustituirlo es cargar
  datos, no cambiar código.
