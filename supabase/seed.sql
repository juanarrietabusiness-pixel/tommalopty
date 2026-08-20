-- =============================================================================
-- Datos de demostración (supabase db reset)
-- =============================================================================
-- Reproduce el contenido de marcador de posición del esqueleto original para que
-- la tienda arranque con el mismo aspecto. Sustituir por el catálogo real de la
-- clienta antes de pasar a producción.
-- =============================================================================

-- --- Ajustes de tienda --------------------------------------------------------
insert into public.settings (key, value, description, is_public) values
  ('brand', jsonb_build_object(
      'name', 'Nébula Store',
      'tagline', 'Plantilla base de tienda online',
      'email', 'hola@tudominio.com',
      'whatsapp', ''
    ), 'Identidad de marca mostrada en header, footer y emails', true),
  ('store', jsonb_build_object(
      'currency', 'USD',
      'country', 'PA',
      'free_shipping_threshold', 50,
      'tax_rate', 0
    ), 'Parámetros comerciales de la tienda', true),
  ('checkout', jsonb_build_object(
      'guest_checkout_enabled', true,
      'terms_url', '/p/terminos'
    ), 'Comportamiento del checkout', true)
on conflict (key) do nothing;

-- --- Integraciones (desactivadas hasta cargar credenciales) -------------------
insert into public.integrations (provider, is_enabled, environment, config) values
  ('paypal',        false, 'sandbox', '{"label":"PayPal","supports":["card","paypal_balance"]}'),
  ('wompi',         false, 'sandbox', '{"label":"Wompi (Banistmo)","supports":["card"]}'),
  ('paguelofacil',  false, 'sandbox', '{"label":"PagueloFacil","supports":["card","clave"]}'),
  ('yappy',         false, 'sandbox', '{"label":"Yappy","supports":["qr"]}'),
  ('meta_pixel',    false, 'sandbox', '{"label":"Meta Pixel + Conversions API"}'),
  ('resend',        false, 'sandbox', '{"label":"Resend (email transaccional)"}')
on conflict (provider) do nothing;

-- --- Métodos de envío ---------------------------------------------------------
insert into public.shipping_methods (name, description, price, free_above_subtotal, estimated_days_min, estimated_days_max, position)
values
  ('Envío estándar', 'Entrega a domicilio en Panamá', 5.00, 50.00, 2, 5, 1),
  ('Envío exprés', 'Entrega en 24-48 horas', 12.00, null, 1, 2, 2),
  ('Retiro en tienda', 'Recoge tu pedido sin costo', 0.00, null, 0, 1, 3)
on conflict do nothing;

-- --- Categorías ---------------------------------------------------------------
insert into public.categories (slug, name, description, position) values
  ('novedades', 'Novedades', 'Lo último que ha llegado a la tienda', 1),
  ('ofertas', 'Ofertas', 'Productos con descuento activo', 2),
  ('mas-vendidos', 'Más vendidos', 'Los favoritos de nuestros clientes', 3)
on conflict (slug) do nothing;

-- --- Catálogo de demostración -------------------------------------------------
-- Mismos títulos y precios que el esqueleto HTML original.
with demo(idx, title, price, compare_at, on_offer) as (
  values
    (1,  'Producto destacado uno',    29.98, 37.97, true),
    (2,  'Producto destacado dos',    23.80, 32.99, true),
    (3,  'Producto destacado tres',   27.77, 38.99, true),
    (4,  'Producto destacado cuatro', 24.85, 30.75, false),
    (5,  'Producto destacado cinco',  32.90, 48.00, true),
    (6,  'Producto destacado seis',   27.57, 40.77, true),
    (7,  'Producto destacado siete',  24.95, 34.99, true),
    (8,  'Producto destacado ocho',   44.77, 52.99, true),
    (9,  'Producto destacado nueve',  25.99, 38.00, false),
    (10, 'Producto destacado diez',   27.50, 37.87, true)
),
inserted_products as (
  insert into public.products (slug, title, subtitle, description, status, is_featured, tags, published_at)
  select
    public.slugify(d.title),
    d.title,
    'Contenido de marcador de posición',
    'Descripción de ejemplo. Sustituir por el texto real del producto desde el panel administrativo.',
    'active',
    d.on_offer,
    array['demo'],
    now()
  from demo d
  on conflict (slug) do nothing
  returning id, title
),
inserted_variants as (
  insert into public.product_variants (product_id, sku, title, price, compare_at_price, is_default)
  select
    p.id,
    'DEMO-' || lpad(d.idx::text, 3, '0'),
    'Estándar',
    d.price,
    case when d.on_offer then d.compare_at else null end,
    true
  from inserted_products p
  join demo d on d.title = p.title
  returning id
)
insert into public.product_categories (product_id, category_id)
select p.id, c.id
from inserted_products p
cross join public.categories c
where c.slug = 'mas-vendidos'
on conflict do nothing;

-- Stock inicial para las variantes de demostración.
update public.inventory i
set quantity = 25
from public.product_variants v
where v.id = i.variant_id and v.sku like 'DEMO-%';

-- --- Contenido del CMS --------------------------------------------------------
insert into public.cms_banners (placement, eyebrow, title, subtitle, cta_label, cta_url, is_active, position) values
  ('announcement_bar', 'Oferta destacada', 'Hasta -45% OFF',
   'Envío gratis en pedidos superiores a $50', null, '/tienda', true, 1),
  ('hero', 'Nueva colección', 'Toda la tienda en descuento',
   null, 'Ver ofertas', '/tienda', true, 1),
  ('cta_band', null, 'Únete y recibe -10% en tu primera compra',
   'Suscríbete para enterarte de nuevos lanzamientos y ofertas exclusivas.',
   'Suscribirme', null, true, 1)
on conflict do nothing;

insert into public.cms_menus (location, items) values
  ('header', '[
     {"label":"Inicio","url":"/"},
     {"label":"Tienda","url":"/tienda"},
     {"label":"Contacto","url":"/p/contacto"}
   ]'::jsonb),
  ('footer_shop', '[
     {"label":"Todos los productos","url":"/tienda"},
     {"label":"Ofertas","url":"/tienda?filtro=ofertas"},
     {"label":"Novedades","url":"/tienda?filtro=novedades"}
   ]'::jsonb),
  ('footer_help', '[
     {"label":"Contacto","url":"/p/contacto"},
     {"label":"Envíos","url":"/p/envios"},
     {"label":"Cambios y devoluciones","url":"/p/devoluciones"}
   ]'::jsonb)
on conflict (location) do nothing;

-- --- Páginas del CMS ---------------------------------------------------------
-- Las cuatro páginas legales (envíos, devoluciones, términos y privacidad) son
-- requisito para abrir al público: la Ley 81 de 2019 exige informar del
-- tratamiento de datos, y ninguna pasarela de pago aprueba un comercio sin
-- términos, privacidad y política de devoluciones visibles.
--
-- Son BORRADORES. Llevan los datos de la empresa entre corchetes y un aviso
-- visible en la propia página, para que nadie los dé por buenos por descuido.
-- El checklist para dejarlos listos está en docs/RUNBOOK.md.
insert into public.cms_pages (slug, title, status, content, seo_description, published_at) values
  ('contacto', 'Contacto', 'published',
   '[{"type": "richtext", "value": "Escríbenos a [CORREO DE CONTACTO] y te respondemos en menos de 24 horas hábiles."}]'::jsonb,
   'Cómo ponerte en contacto con nosotros.',
   now()),
  ('envios', 'Envíos', 'published',
   '[{"type": "richtext", "value": "BORRADOR PENDIENTE DE REVISIÓN LEGAL. Este texto es un punto de partida, no un documento validado. Antes de abrir la tienda al público hay que completar los datos de la empresa y hacerlo revisar por un abogado en Panamá. Ver docs/RUNBOOK.md → \"Antes de abrir al público\"."}, {"type": "heading", "value": "Dónde enviamos"}, {"type": "richtext", "value": "Enviamos a todo Panamá."}, {"type": "heading", "value": "Costo y plazos"}, {"type": "richtext", "value": "El costo del envío se calcula y se muestra en el checkout antes de que confirmes el pedido. Envío gratis en compras superiores a [UMBRAL]."}, {"type": "richtext", "value": "Plazo estimado: [PLAZO] días hábiles en ciudad de Panamá y [PLAZO INTERIOR] días hábiles al interior. Los plazos empiezan a contar desde que se confirma el pago, no desde que se hace el pedido."}, {"type": "heading", "value": "Seguimiento"}, {"type": "richtext", "value": "Cuando tu pedido sale, te avisamos por correo. Si el transporte facilita número de guía, lo incluimos en ese mismo correo."}, {"type": "heading", "value": "Entregas fallidas"}, {"type": "richtext", "value": "Si no hay nadie en la dirección indicada, el transporte intentará la entrega de nuevo. Tras [INTENTOS] intentos, el pedido vuelve a nuestro almacén y nos pondremos en contacto contigo."}]'::jsonb,
   'Costos, plazos y cobertura de envío en Panamá.',
   now()),
  ('devoluciones', 'Cambios y devoluciones', 'published',
   '[{"type": "richtext", "value": "BORRADOR PENDIENTE DE REVISIÓN LEGAL. Este texto es un punto de partida, no un documento validado. Antes de abrir la tienda al público hay que completar los datos de la empresa y hacerlo revisar por un abogado en Panamá. Ver docs/RUNBOOK.md → \"Antes de abrir al público\"."}, {"type": "heading", "value": "Plazo"}, {"type": "richtext", "value": "Tienes 30 días naturales desde que recibes el pedido para solicitar un cambio o una devolución."}, {"type": "heading", "value": "Condiciones"}, {"type": "richtext", "value": "El producto debe estar sin usar, en su empaque original y con sus etiquetas. Por higiene, no se aceptan devoluciones de productos abiertos en las categorías [CATEGORÍAS EXCLUIDAS]."}, {"type": "heading", "value": "Cómo solicitarlo"}, {"type": "richtext", "value": "Escríbenos a [CORREO DE CONTACTO] con tu número de pedido y el motivo. Te respondemos en menos de 24 horas hábiles con las instrucciones de envío."}, {"type": "heading", "value": "Reembolsos"}, {"type": "richtext", "value": "Una vez recibido y revisado el producto, el reembolso se emite por el mismo medio de pago que usaste. El tiempo que tarda en reflejarse depende de tu banco o de la pasarela, normalmente entre 5 y 10 días hábiles."}, {"type": "heading", "value": "Producto defectuoso o equivocado"}, {"type": "richtext", "value": "Si el producto llega dañado o no es el que pediste, el costo del envío de devolución corre por nuestra cuenta. Avísanos dentro de las 48 horas siguientes a la entrega, con fotos si es posible."}]'::jsonb,
   'Plazos y condiciones para cambiar o devolver un producto.',
   now()),
  ('terminos', 'Términos y condiciones', 'published',
   '[{"type": "richtext", "value": "BORRADOR PENDIENTE DE REVISIÓN LEGAL. Este texto es un punto de partida, no un documento validado. Antes de abrir la tienda al público hay que completar los datos de la empresa y hacerlo revisar por un abogado en Panamá. Ver docs/RUNBOOK.md → \"Antes de abrir al público\"."}, {"type": "heading", "value": "Quién vende"}, {"type": "richtext", "value": "Esta tienda la opera [RAZÓN SOCIAL], RUC [RUC], con domicilio en [DIRECCIÓN], Panamá. Contacto: [CORREO DE CONTACTO], [TELÉFONO]."}, {"type": "heading", "value": "Precios y moneda"}, {"type": "richtext", "value": "Todos los precios se muestran en dólares estadounidenses (USD), moneda de curso legal en Panamá, e incluyen los impuestos aplicables salvo que se indique lo contrario. El costo de envío se calcula y se muestra antes de confirmar el pedido."}, {"type": "richtext", "value": "El importe que se cobra es siempre el que calcula nuestro servidor a partir del catálogo en el momento de la compra, no el que muestre una página guardada en tu navegador."}, {"type": "heading", "value": "Cómo se formaliza un pedido"}, {"type": "richtext", "value": "Al confirmar el pedido recibes un correo con su número. Ese correo acusa recibo, no confirma el pago. El pedido queda formalizado cuando la pasarela confirma el cobro, y entonces te lo comunicamos con un segundo correo."}, {"type": "richtext", "value": "Podemos rechazar o anular un pedido si el producto ya no está disponible, si detectamos un error evidente en el precio publicado o si hay indicios de fraude. En ese caso te devolvemos el importe íntegro."}, {"type": "heading", "value": "Disponibilidad"}, {"type": "richtext", "value": "Un pedido reserva las unidades durante un tiempo limitado. Si el pago no se confirma en ese plazo, la reserva se libera y las unidades vuelven a estar disponibles para otros clientes."}, {"type": "heading", "value": "Derecho de retracto y garantías"}, {"type": "richtext", "value": "Tus derechos como consumidor están amparados por la Ley 45 de 2007 de Protección al Consumidor y Defensa de la Competencia. Las condiciones de cambio y devolución se detallan en la página de Cambios y devoluciones, y no sustituyen ni limitan esos derechos."}, {"type": "heading", "value": "Propiedad intelectual"}, {"type": "richtext", "value": "Los textos, imágenes, logotipos y demás contenidos de esta tienda son propiedad de [RAZÓN SOCIAL] o se usan con autorización. No se permite su reproducción sin permiso escrito."}, {"type": "heading", "value": "Ley aplicable"}, {"type": "richtext", "value": "Estas condiciones se rigen por la legislación de la República de Panamá. Cualquier controversia se someterá a los tribunales competentes de Panamá, sin perjuicio de las vías de reclamación ante la ACODECO."}, {"type": "richtext", "value": "Última actualización: [FECHA]."}]'::jsonb,
   'Condiciones de venta de la tienda.',
   now()),
  ('privacidad', 'Política de privacidad', 'published',
   '[{"type": "richtext", "value": "BORRADOR PENDIENTE DE REVISIÓN LEGAL. Este texto es un punto de partida, no un documento validado. Antes de abrir la tienda al público hay que completar los datos de la empresa y hacerlo revisar por un abogado en Panamá. Ver docs/RUNBOOK.md → \"Antes de abrir al público\"."}, {"type": "heading", "value": "Quién trata tus datos"}, {"type": "richtext", "value": "El responsable del tratamiento es [RAZÓN SOCIAL], con RUC [RUC] y domicilio en [DIRECCIÓN], Panamá. Para cualquier asunto relacionado con tus datos personales puedes escribir a [CORREO DE CONTACTO]."}, {"type": "heading", "value": "Qué datos recogemos y para qué"}, {"type": "richtext", "value": "Para gestionar tu compra: nombre, apellido, correo electrónico, teléfono y dirección de envío. Sin estos datos no podemos procesar ni entregar un pedido."}, {"type": "richtext", "value": "Si te suscribes al boletín: tu correo electrónico, para enviarte novedades y promociones. Puedes darte de baja en cualquier momento desde el propio correo."}, {"type": "richtext", "value": "De forma automática, datos de navegación (páginas visitadas, dispositivo, origen de la visita) para entender cómo se usa la tienda y mejorarla."}, {"type": "heading", "value": "Datos de tarjeta"}, {"type": "richtext", "value": "No recibimos, no procesamos y no almacenamos números de tarjeta. El pago se realiza íntegramente en la plataforma de la pasarela contratada, que es quien trata esos datos bajo sus propias condiciones."}, {"type": "heading", "value": "Con quién los compartimos"}, {"type": "richtext", "value": "Solo con quien hace falta para que la tienda funcione: la pasarela de pago, la empresa de transporte que entrega tu pedido, el proveedor de correo transaccional y el proveedor de alojamiento e infraestructura. No vendemos datos personales a terceros."}, {"type": "richtext", "value": "Si usamos herramientas de medición y publicidad, como el píxel de Meta, compartimos con ellas identificadores de evento y datos de contacto cifrados para atribuir compras. Puedes oponerte desde la configuración de tu navegador y de tu cuenta en esas plataformas."}, {"type": "heading", "value": "Cuánto tiempo los guardamos"}, {"type": "richtext", "value": "Los datos de un pedido se conservan mientras dure la relación comercial y después durante los plazos que exija la normativa fiscal y mercantil panameña. Los datos del boletín, hasta que te des de baja."}, {"type": "heading", "value": "Tus derechos"}, {"type": "richtext", "value": "Conforme a la Ley 81 de 2019 de Protección de Datos Personales, puedes solicitar el acceso, la rectificación, la cancelación, la oposición y la portabilidad de tus datos escribiendo a [CORREO DE CONTACTO]. Responderemos en los plazos que fija la ley. Si consideras que no hemos atendido tu solicitud correctamente, puedes acudir a la Autoridad Nacional de Transparencia y Acceso a la Información (ANTAI)."}, {"type": "heading", "value": "Cambios en esta política"}, {"type": "richtext", "value": "Si cambiamos esta política, publicaremos la versión nueva en esta misma página con su fecha de actualización. Última actualización: [FECHA]."}]'::jsonb,
   'Qué datos personales tratamos, para qué y cuáles son tus derechos.',
   now())
on conflict (slug) do nothing;

insert into public.crm_tags (name, color, description) values
  ('VIP', '#ff5a1f', 'Clientes con alto valor de vida'),
  ('Mayorista', '#173c2e', 'Compra por volumen'),
  ('Recuperación', '#6b7280', 'Sin compras en los últimos 6 meses')
on conflict (name) do nothing;
