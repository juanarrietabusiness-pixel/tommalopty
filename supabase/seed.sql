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

insert into public.cms_pages (slug, title, status, content, published_at) values
  ('contacto', 'Contacto', 'published',
   '[{"type":"richtext","value":"Escríbenos a hola@tudominio.com y te respondemos en menos de 24 horas."}]'::jsonb,
   now()),
  ('envios', 'Envíos', 'published',
   '[{"type":"richtext","value":"Enviamos a todo Panamá. Envío gratis en pedidos superiores a $50."}]'::jsonb,
   now()),
  ('devoluciones', 'Cambios y devoluciones', 'published',
   '[{"type":"richtext","value":"Tienes 30 días para solicitar un cambio o devolución."}]'::jsonb,
   now()),
  ('terminos', 'Términos y políticas', 'published',
   '[{"type":"richtext","value":"Contenido pendiente de redacción legal."}]'::jsonb,
   now())
on conflict (slug) do nothing;

insert into public.crm_tags (name, color, description) values
  ('VIP', '#ff5a1f', 'Clientes con alto valor de vida'),
  ('Mayorista', '#173c2e', 'Compra por volumen'),
  ('Recuperación', '#6b7280', 'Sin compras en los últimos 6 meses')
on conflict (name) do nothing;
