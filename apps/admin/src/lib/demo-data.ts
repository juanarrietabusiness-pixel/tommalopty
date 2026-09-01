import type { Tables } from '@nebula/db';

/**
 * Datos del recorrido de demostración del panel.
 *
 * Existen por el mismo motivo que los de la tienda: poder revisar la interfaz
 * antes de que haya una base de datos conectada. Sin ellos el panel devolvía un
 * 500 en las diecisiete pantallas y solo se veía la de acceso, así que no se
 * podía enseñar nada de lo construido.
 *
 * REGLAS, y no son de estilo:
 *
 *  1. Solo se usan cuando NO hay Supabase configurado. Nunca porque una
 *     consulta falle. Confundir las dos cosas fue un fallo real de la tienda
 *     —una base caída acabó enseñando precios inventados a clientes de verdad—
 *     y aquí sería peor: decisiones de negocio tomadas sobre cifras que no
 *     existen.
 *  2. Solo lectura. Las escrituras están cortadas en las diecisiete acciones
 *     por `bloqueadoEnDemostracion`.
 *  3. Se ven como lo que son. El panel pinta un aviso permanente arriba.
 *
 * En producción Supabase siempre está configurado, así que nada de esto se
 * ejecuta: el panel desplegado es el mismo, con los datos reales.
 */

/** Fechas relativas a la carga, para que el panel no parezca congelado. */
function haceDias(dias: number, hora = 10): string {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() - dias);
  fecha.setHours(hora, 0, 0, 0);
  return fecha.toISOString();
}

function uuid(sufijo: string): string {
  return `00000000-0000-4000-8000-${sufijo.padStart(12, '0')}`;
}

/* --- Catálogo -------------------------------------------------------------- */

type Producto = Tables<'products'>;

function producto(
  n: number,
  campos: Partial<Producto> & Pick<Producto, 'slug' | 'title'>,
): Producto {
  return {
    id: uuid(`p${n}`),
    subtitle: null,
    description: null,
    brand: 'Nébula',
    status: 'active',
    is_featured: false,
    tags: [],
    seo_title: null,
    seo_description: null,
    rating_average: 0,
    rating_count: 0,
    published_at: haceDias(n + 3),
    created_by: null,
    created_at: haceDias(n + 10),
    updated_at: haceDias(n),
    search_vector: null,
    ...campos,
  };
}

export const PRODUCTOS_DEMO: Producto[] = [
  producto(1, {
    slug: 'cafe-organico-250g',
    title: 'Café orgánico de Boquete 250 g',
    subtitle: 'Tueste medio, cosecha de altura',
    status: 'active',
    is_featured: true,
    rating_average: 4.8,
    rating_count: 34,
    tags: ['café', 'orgánico'],
  }),
  producto(2, {
    slug: 'taza-ceramica-artesanal',
    title: 'Taza de cerámica artesanal',
    subtitle: 'Hecha a mano en Chiriquí',
    rating_average: 4.5,
    rating_count: 12,
  }),
  producto(3, {
    slug: 'prensa-francesa-600ml',
    title: 'Prensa francesa 600 ml',
    is_featured: true,
    rating_average: 4.9,
    rating_count: 51,
  }),
  producto(4, {
    slug: 'molinillo-manual',
    title: 'Molinillo manual de acero',
    rating_average: 4.2,
    rating_count: 8,
  }),
  producto(5, {
    slug: 'set-degustacion',
    title: 'Set de degustación · 4 orígenes',
    status: 'draft',
    published_at: null,
  }),
];

export const CATEGORIAS_DEMO: Tables<'categories'>[] = [
  {
    id: uuid('c1'),
    parent_id: null,
    slug: 'cafe',
    name: 'Café',
    description: 'Grano y molido, de origen panameño',
    image_url: null,
    position: 1,
    is_active: true,
    seo_title: null,
    seo_description: null,
    created_at: haceDias(40),
    updated_at: haceDias(40),
  },
  {
    id: uuid('c2'),
    parent_id: null,
    slug: 'accesorios',
    name: 'Accesorios',
    description: 'Todo lo que hace falta para prepararlo',
    image_url: null,
    position: 2,
    is_active: true,
    seo_title: null,
    seo_description: null,
    created_at: haceDias(40),
    updated_at: haceDias(38),
  },
  {
    id: uuid('c3'),
    parent_id: null,
    slug: 'regalo',
    name: 'Para regalar',
    description: null,
    image_url: null,
    position: 3,
    is_active: false,
    seo_title: null,
    seo_description: null,
    created_at: haceDias(35),
    updated_at: haceDias(20),
  },
];

type Variante = Tables<'product_variants'>;

export const VARIANTES_DEMO: Variante[] = PRODUCTOS_DEMO.map((p, i) => ({
  id: uuid(`v${i + 1}`),
  product_id: p.id,
  sku: `NB-${String(i + 1).padStart(4, '0')}`,
  barcode: null,
  title: 'Estándar',
  price: [12.5, 18.0, 39.9, 45.0, 52.0][i] ?? 20,
  compare_at_price: i === 0 ? 15.0 : null,
  cost_price: null,
  weight_grams: null,
  option_values: {},
  image_url: null,
  position: 0,
  is_default: true,
  is_active: true,
  created_at: haceDias(30),
  updated_at: haceDias(5),
}));

export const INVENTARIO_DEMO: Tables<'inventory'>[] = VARIANTES_DEMO.map((v, i) => ({
  variant_id: v.id,
  quantity: [42, 3, 17, 0, 25][i] ?? 10,
  reserved_quantity: [2, 1, 0, 0, 0][i] ?? 0,
  low_stock_threshold: 5,
  track_inventory: true,
  allow_backorder: false,
  location: 'principal',
  updated_at: haceDias(i + 1),
}));

/* --- Pedidos --------------------------------------------------------------- */

type Pedido = Tables<'orders'>;

function pedido(n: number, campos: Partial<Pedido> & Pick<Pedido, 'email' | 'total'>): Pedido {
  const subtotal = campos.subtotal ?? campos.total;
  return {
    id: uuid(`o${n}`),
    order_number: `NB-${String(1000 + n).padStart(6, '0')}`,
    customer_id: null,
    phone: '+507 6000-0000',
    status: 'confirmed',
    payment_status: 'paid',
    fulfillment_status: 'unfulfilled',
    currency: 'USD',
    subtotal,
    // El recorrido de demostración enseña pedidos ya cobrados: el saldo es
    // cero y el estado, pagado. Los abonos se ven contra la base de verdad.
    amount_paid: campos.total,
    balance_due: 0,
    discount_total: 0,
    shipping_total: 0,
    tax_total: 0,
    discount_code: null,
    shipping_address: {
      firstName: 'Ana',
      lastName: 'Pérez',
      line1: 'Calle 50, Edificio Torre',
      city: 'Ciudad de Panamá',
      countryCode: 'PA',
    },
    billing_address: null,
    shipping_method: { name: 'Envío estándar', price: 5 },
    customer_note: null,
    internal_note: null,
    cancelled_reason: null,
    cart_id: null,
    placed_at: haceDias(n),
    created_at: haceDias(n),
    updated_at: haceDias(n),
    confirmation_token: `demo${n}`,
    ...campos,
  };
}

export const PEDIDOS_DEMO: Pedido[] = [
  pedido(1, {
    email: 'ana.perez@ejemplo.com',
    total: 43.4,
    subtotal: 38.4,
    shipping_total: 5,
    customer_id: uuid('u1'),
    fulfillment_status: 'fulfilled',
    status: 'delivered',
  }),
  pedido(2, {
    email: 'luis.gomez@ejemplo.com',
    total: 39.9,
    status: 'processing',
    customer_id: uuid('u2'),
  }),
  pedido(3, {
    email: 'maria.rodriguez@ejemplo.com',
    total: 62.5,
    subtotal: 57.5,
    shipping_total: 5,
    status: 'pending',
    payment_status: 'pending',
    placed_at: null,
    customer_id: uuid('u3'),
  }),
  pedido(4, {
    email: 'carlos.mendoza@ejemplo.com',
    total: 18.0,
    status: 'shipped',
    fulfillment_status: 'partial',
    customer_id: uuid('u4'),
  }),
  pedido(5, {
    email: 'ana.perez@ejemplo.com',
    total: 25.0,
    status: 'cancelled',
    payment_status: 'cancelled',
    cancelled_reason: 'Reserva caducada: 2 h sin confirmar el pago',
    placed_at: null,
    customer_id: uuid('u1'),
  }),
  pedido(6, { email: 'invitado@ejemplo.com', total: 12.5, status: 'confirmed' }),
  pedido(7, { email: 'sofia.castillo@ejemplo.com', total: 91.3, customer_id: uuid('u5') }),
  pedido(8, { email: 'luis.gomez@ejemplo.com', total: 45.0, customer_id: uuid('u2') }),
];

export const LINEAS_DEMO: Tables<'order_items'>[] = [
  {
    id: uuid('i1'),
    order_id: PEDIDOS_DEMO[0]!.id,
    variant_id: VARIANTES_DEMO[0]!.id,
    product_id: PRODUCTOS_DEMO[0]!.id,
    product_title: PRODUCTOS_DEMO[0]!.title,
    variant_title: 'Estándar',
    sku: 'NB-0001',
    image_url: null,
    unit_price: 12.5,
    quantity: 2,
    discount_total: 0,
    total: 25.0,
    created_at: haceDias(1),
  },
  {
    id: uuid('i2'),
    order_id: PEDIDOS_DEMO[0]!.id,
    variant_id: VARIANTES_DEMO[1]!.id,
    product_id: PRODUCTOS_DEMO[1]!.id,
    product_title: PRODUCTOS_DEMO[1]!.title,
    variant_title: 'Estándar',
    sku: 'NB-0002',
    image_url: null,
    unit_price: 18.0,
    quantity: 1,
    discount_total: 0,
    total: 18.0,
    created_at: haceDias(1),
  },
];

export const EVENTOS_DEMO: Tables<'order_events'>[] = [
  {
    id: uuid('e1'),
    order_id: PEDIDOS_DEMO[0]!.id,
    actor_id: null,
    type: 'status_change',
    message: 'Pedido confirmado tras verificar el pago.',
    metadata: {},
    created_at: haceDias(1, 11),
  },
  {
    id: uuid('e2'),
    order_id: PEDIDOS_DEMO[0]!.id,
    actor_id: null,
    type: 'note',
    message: 'La clienta pidió entrega antes del viernes.',
    metadata: {},
    created_at: haceDias(1, 12),
  },
  {
    id: uuid('e3'),
    order_id: PEDIDOS_DEMO[0]!.id,
    actor_id: null,
    type: 'status_change',
    message: 'Pedido entregado.',
    metadata: {},
    created_at: haceDias(0, 9),
  },
];

export const PAGOS_DEMO: Tables<'payments'>[] = [
  {
    id: uuid('y1'),
    order_id: PEDIDOS_DEMO[0]!.id,
    provider: 'manual',
    provider_payment_id: null,
    reference: 'Efectivo en tienda',
    // Sin comprobante: en el recorrido de demostración no hay bucket, y una
    // clave inventada daría un enlace roto en vez de la ausencia de enlace.
    receipt_key: null,
    status: 'paid',
    amount: 43.4,
    currency: 'USD',
    provider_response: {},
    error_message: null,
    processed_at: haceDias(1, 11),
    created_at: haceDias(1, 10),
    updated_at: haceDias(1, 11),
  },
];

/* --- Clientes / CRM -------------------------------------------------------- */

type Cliente = Tables<'customers'>;

function cliente(
  n: number,
  campos: Partial<Cliente> & Pick<Cliente, 'email' | 'first_name'>,
): Cliente {
  return {
    id: uuid(`u${n}`),
    profile_id: null,
    last_name: 'Ejemplo',
    phone: '+507 6000-0000',
    accepts_marketing: true,
    marketing_opt_in_at: haceDias(30),
    tags: [],
    orders_count: 1,
    total_spent: 0,
    last_order_at: haceDias(n),
    notes_count: 0,
    created_at: haceDias(45),
    updated_at: haceDias(n),
    ...campos,
  };
}

export const CLIENTES_DEMO: Cliente[] = [
  cliente(1, {
    email: 'ana.perez@ejemplo.com',
    first_name: 'Ana',
    last_name: 'Pérez',
    orders_count: 2,
    total_spent: 68.4,
    tags: ['VIP'],
    notes_count: 2,
  }),
  cliente(2, {
    email: 'luis.gomez@ejemplo.com',
    first_name: 'Luis',
    last_name: 'Gómez',
    orders_count: 2,
    total_spent: 84.9,
  }),
  cliente(3, {
    email: 'maria.rodriguez@ejemplo.com',
    first_name: 'María',
    last_name: 'Rodríguez',
    total_spent: 0,
    accepts_marketing: false,
    marketing_opt_in_at: null,
  }),
  cliente(4, {
    email: 'carlos.mendoza@ejemplo.com',
    first_name: 'Carlos',
    last_name: 'Mendoza',
    total_spent: 18.0,
    tags: ['Mayorista'],
  }),
  cliente(5, {
    email: 'sofia.castillo@ejemplo.com',
    first_name: 'Sofía',
    last_name: 'Castillo',
    total_spent: 91.3,
  }),
];

export const NOTAS_DEMO: Tables<'crm_notes'>[] = [
  {
    id: uuid('n1'),
    customer_id: CLIENTES_DEMO[0]!.id,
    author_id: null,
    body: 'Compra café todos los meses. Preguntó por suscripción.',
    is_pinned: true,
    created_at: haceDias(20),
    updated_at: haceDias(20),
  },
  {
    id: uuid('n2'),
    customer_id: CLIENTES_DEMO[0]!.id,
    author_id: null,
    body: 'Incidencia de envío resuelta: se reenvió sin costo.',
    is_pinned: false,
    created_at: haceDias(8),
    updated_at: haceDias(8),
  },
];

export const ETIQUETAS_DEMO: Tables<'crm_tags'>[] = [
  {
    id: uuid('t1'),
    name: 'VIP',
    color: '#ff5a1f',
    description: 'Clientes con alto valor de vida',
    created_at: haceDias(50),
  },
  {
    id: uuid('t2'),
    name: 'Mayorista',
    color: '#173c2e',
    description: 'Compra por volumen',
    created_at: haceDias(50),
  },
  {
    id: uuid('t3'),
    name: 'Recuperación',
    color: '#6b7280',
    description: 'Sin compras en los últimos 6 meses',
    created_at: haceDias(50),
  },
];

/* --- Descuentos ------------------------------------------------------------ */

export const DESCUENTOS_DEMO: Tables<'discounts'>[] = [
  {
    id: uuid('d1'),
    code: 'BIENVENIDA10',
    description: '10 % en la primera compra',
    type: 'percentage',
    value: 10,
    min_subtotal: 0,
    applies_to: {},
    usage_limit: null,
    usage_limit_per_customer: 1,
    usage_count: 37,
    starts_at: haceDias(60),
    ends_at: null,
    is_active: true,
    created_by: null,
    created_at: haceDias(60),
    updated_at: haceDias(60),
  },
  {
    id: uuid('d2'),
    code: 'ENVIOGRATIS',
    description: 'Envío gratis sin mínimo',
    type: 'free_shipping',
    value: 0,
    min_subtotal: 0,
    applies_to: {},
    usage_limit: 100,
    usage_limit_per_customer: null,
    usage_count: 12,
    starts_at: haceDias(15),
    ends_at: haceDias(-15),
    is_active: true,
    created_by: null,
    created_at: haceDias(15),
    updated_at: haceDias(15),
  },
  {
    id: uuid('d3'),
    code: 'NAVIDAD25',
    description: '25 % en pedidos superiores a $50',
    type: 'percentage',
    value: 25,
    min_subtotal: 50,
    applies_to: {},
    usage_limit: 200,
    usage_limit_per_customer: 1,
    usage_count: 0,
    starts_at: haceDias(-30),
    ends_at: haceDias(-60),
    is_active: false,
    created_by: null,
    created_at: haceDias(5),
    updated_at: haceDias(5),
  },
];

/* --- Contenido ------------------------------------------------------------- */

export const BANNERS_DEMO: Tables<'cms_banners'>[] = [
  {
    id: uuid('b1'),
    placement: 'announcement_bar',
    eyebrow: null,
    title: 'Envío gratis en pedidos superiores a $50',
    subtitle: null,
    cta_label: null,
    cta_url: null,
    media_url: null,
    theme: {},
    position: 0,
    is_active: true,
    starts_at: null,
    ends_at: null,
    created_by: null,
    created_at: haceDias(30),
    updated_at: haceDias(4),
  },
  {
    id: uuid('b2'),
    placement: 'hero',
    eyebrow: 'Cosecha 2026',
    title: 'Café de altura, tostado esta semana',
    subtitle: 'De Boquete a tu casa en 48 horas',
    cta_label: 'Ver el catálogo',
    cta_url: '/tienda',
    media_url: null,
    theme: {},
    position: 0,
    is_active: true,
    starts_at: null,
    ends_at: null,
    created_by: null,
    created_at: haceDias(30),
    updated_at: haceDias(2),
  },
  {
    id: uuid('b3'),
    placement: 'cta_band',
    eyebrow: null,
    title: 'Recibe las novedades antes que nadie',
    subtitle: 'Sin spam. Solo cuando hay cosecha nueva.',
    cta_label: 'Suscribirme',
    cta_url: null,
    media_url: null,
    theme: {},
    position: 0,
    is_active: true,
    starts_at: null,
    ends_at: null,
    created_by: null,
    created_at: haceDias(30),
    updated_at: haceDias(30),
  },
];

export const MENUS_DEMO: Tables<'cms_menus'>[] = [
  {
    id: uuid('m1'),
    location: 'header',
    items: [
      { label: 'Inicio', url: '/' },
      { label: 'Tienda', url: '/tienda' },
      { label: 'Contacto', url: '/p/contacto' },
    ],
    updated_at: haceDias(12),
  },
  {
    id: uuid('m2'),
    location: 'footer_shop',
    items: [
      { label: 'Todos los productos', url: '/tienda' },
      { label: 'Ofertas', url: '/tienda?filtro=ofertas' },
      { label: 'Novedades', url: '/tienda?filtro=novedades' },
    ],
    updated_at: haceDias(12),
  },
  {
    id: uuid('m3'),
    location: 'footer_help',
    items: [
      { label: 'Contacto', url: '/p/contacto' },
      { label: 'Envíos', url: '/p/envios' },
      { label: 'Cambios y devoluciones', url: '/p/devoluciones' },
    ],
    updated_at: haceDias(12),
  },
];

export const PAGINAS_DEMO: Tables<'cms_pages'>[] = [
  {
    id: uuid('g1'),
    slug: 'contacto',
    title: 'Contacto',
    status: 'published',
    content: [{ type: 'richtext', value: 'Escríbenos y te respondemos en menos de 24 horas.' }],
    seo_title: null,
    seo_description: 'Cómo ponerte en contacto con nosotros.',
    published_at: haceDias(30),
    created_by: null,
    created_at: haceDias(30),
    updated_at: haceDias(30),
  },
  {
    id: uuid('g2'),
    slug: 'envios',
    title: 'Envíos',
    status: 'published',
    content: [{ type: 'richtext', value: 'Enviamos a todo Panamá.' }],
    seo_title: null,
    seo_description: 'Costos, plazos y cobertura de envío en Panamá.',
    published_at: haceDias(30),
    created_by: null,
    created_at: haceDias(30),
    updated_at: haceDias(6),
  },
  {
    id: uuid('g3'),
    slug: 'devoluciones',
    title: 'Cambios y devoluciones',
    status: 'published',
    content: [{ type: 'richtext', value: 'Tienes 30 días para solicitar un cambio.' }],
    seo_title: null,
    seo_description: 'Plazos y condiciones para cambiar o devolver un producto.',
    published_at: haceDias(30),
    created_by: null,
    created_at: haceDias(30),
    updated_at: haceDias(6),
  },
  {
    id: uuid('g4'),
    slug: 'terminos',
    title: 'Términos y condiciones',
    status: 'published',
    content: [{ type: 'richtext', value: 'Borrador pendiente de revisión legal.' }],
    seo_title: null,
    seo_description: 'Condiciones de venta de la tienda.',
    published_at: haceDias(30),
    created_by: null,
    created_at: haceDias(30),
    updated_at: haceDias(1),
  },
  {
    id: uuid('g5'),
    slug: 'privacidad',
    title: 'Política de privacidad',
    status: 'published',
    content: [{ type: 'richtext', value: 'Borrador pendiente de revisión legal.' }],
    seo_title: null,
    seo_description: 'Qué datos personales tratamos y cuáles son tus derechos.',
    published_at: haceDias(30),
    created_by: null,
    created_at: haceDias(30),
    updated_at: haceDias(1),
  },
];

/* --- Administración -------------------------------------------------------- */

export const PERFILES_DEMO: Tables<'profiles'>[] = [
  {
    id: uuid('f1'),
    email: 'dueña@ejemplo.com',
    full_name: 'Dueña de la tienda',
    phone: null,
    avatar_url: null,
    role: 'superadmin',
    is_active: true,
    last_seen_at: haceDias(0, 8),
    created_at: haceDias(60),
    updated_at: haceDias(0),
  },
  {
    id: uuid('f2'),
    email: 'operaciones@ejemplo.com',
    full_name: 'Equipo de operaciones',
    phone: null,
    avatar_url: null,
    role: 'operator',
    is_active: true,
    last_seen_at: haceDias(1, 16),
    created_at: haceDias(30),
    updated_at: haceDias(1),
  },
  {
    id: uuid('f3'),
    email: 'ana.perez@ejemplo.com',
    full_name: 'Ana Pérez',
    phone: null,
    avatar_url: null,
    role: 'customer',
    is_active: true,
    last_seen_at: haceDias(1, 10),
    created_at: haceDias(45),
    updated_at: haceDias(1),
  },
];

export const INTEGRACIONES_DEMO: Tables<'integrations'>[] = [
  {
    provider: 'paypal',
    is_enabled: false,
    environment: 'sandbox',
    config: {},
    last_checked_at: null,
    updated_by: null,
    updated_at: haceDias(20),
  },
  {
    provider: 'wompi',
    is_enabled: false,
    environment: 'sandbox',
    config: {},
    last_checked_at: null,
    updated_by: null,
    updated_at: haceDias(20),
  },
  {
    provider: 'meta_pixel',
    is_enabled: true,
    environment: 'production',
    config: {},
    last_checked_at: haceDias(2),
    updated_by: null,
    updated_at: haceDias(2),
  },
  {
    provider: 'resend',
    is_enabled: true,
    environment: 'production',
    config: {},
    last_checked_at: haceDias(2),
    updated_by: null,
    updated_at: haceDias(2),
  },
];

/* --- Reportes -------------------------------------------------------------- */

export const METRICAS_DEMO = {
  revenue: 1284.6,
  orders_count: 31,
  average_order_value: 41.44,
  new_customers: 12,
  pending_orders: 2,
  low_stock_items: 2,
};

/** Catorce días de ventas, con forma de semana real: fin de semana más flojo. */
export const VENTAS_DIARIAS_DEMO = Array.from({ length: 14 }, (_, i) => {
  const dias = 13 - i;
  const fecha = new Date();
  fecha.setDate(fecha.getDate() - dias);
  const finDeSemana = fecha.getDay() === 0 || fecha.getDay() === 6;
  const base = finDeSemana ? 45 : 110;
  const variacion = [1, 0.8, 1.3, 0.9, 1.15, 1.05, 0.75][i % 7] ?? 1;

  return {
    day: fecha.toISOString().slice(0, 10),
    orders_count: Math.max(1, Math.round((base / 40) * variacion)),
    revenue: Math.round(base * variacion * 100) / 100,
  };
});
