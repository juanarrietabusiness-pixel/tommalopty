import type { CatalogProduct, CmsPage, ProductDetail } from '@nebula/db';

/**
 * Contenido de respaldo idéntico al del esqueleto original.
 *
 * Se usa únicamente cuando no hay Supabase configurado, para que el equipo (y
 * la clienta) puedan revisar el diseño sin levantar la base de datos. En cuanto
 * existen credenciales, todo sale del catálogo real.
 */
const DEMO_PRODUCTS: {
  title: string;
  price: number;
  compareAt: number | null;
  onSale: boolean;
}[] = [
  { title: 'Producto destacado uno', price: 29.98, compareAt: 37.97, onSale: true },
  { title: 'Producto destacado dos', price: 23.8, compareAt: 32.99, onSale: true },
  { title: 'Producto destacado tres', price: 27.77, compareAt: 38.99, onSale: true },
  { title: 'Producto destacado cuatro', price: 24.85, compareAt: null, onSale: false },
  { title: 'Producto destacado cinco', price: 32.9, compareAt: 48.0, onSale: true },
  { title: 'Producto destacado seis', price: 27.57, compareAt: 40.77, onSale: true },
  { title: 'Producto destacado siete', price: 24.95, compareAt: 34.99, onSale: true },
  { title: 'Producto destacado ocho', price: 44.77, compareAt: 52.99, onSale: true },
  { title: 'Producto destacado nueve', price: 25.99, compareAt: null, onSale: false },
  { title: 'Producto destacado diez', price: 27.5, compareAt: 37.87, onSale: true },
];

function slugFor(title: string): string {
  return title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function getDemoProducts(): CatalogProduct[] {
  return DEMO_PRODUCTS.map((product, index) => ({
    id: `demo-${index + 1}`,
    slug: slugFor(product.title),
    title: product.title,
    subtitle: 'Contenido de marcador de posición',
    brand: null,
    status: 'active',
    is_featured: product.onSale,
    tags: ['demo'],
    rating_average: 0,
    rating_count: 0,
    published_at: null,
    default_variant_id: `demo-variant-${index + 1}`,
    sku: `DEMO-${String(index + 1).padStart(3, '0')}`,
    price: product.price,
    compare_at_price: product.compareAt,
    image_url: null,
    image_alt: null,
    on_sale: product.onSale,
    discount_percent: product.compareAt
      ? Math.round((1 - product.price / product.compareAt) * 100)
      : 0,
    available_quantity: 25,
    track_inventory: true,
  }));
}

export const DEMO_ANNOUNCEMENT = {
  eyebrow: 'Oferta destacada',
  title: 'Hasta -45% OFF',
  subtitle: 'Envío gratis en pedidos superiores a $50',
};

export const DEMO_HERO = {
  eyebrow: 'Nueva colección',
  title: 'Toda la tienda en descuento',
  ctaLabel: 'Ver ofertas',
  ctaHref: '/tienda',
};

export const DEMO_CTA_BAND = {
  title: 'Únete y recibe -10% en tu primera compra',
  subtitle: 'Suscríbete para enterarte de nuevos lanzamientos y ofertas exclusivas.',
  ctaLabel: 'Suscribirme',
};

/**
 * Ficha completa de un producto de demostración.
 *
 * Sin esto, la portada y el catálogo enlazaban a fichas que devolvían 404: la
 * página más importante de una tienda se rompía en mitad del recorrido, justo
 * al hacer lo primero que hace cualquiera que abre una tienda, que es pinchar
 * un producto.
 */
export function getDemoProductBySlug(slug: string): ProductDetail | null {
  const indice = DEMO_PRODUCTS.findIndex((producto) => slugFor(producto.title) === slug);
  if (indice === -1) return null;

  const producto = DEMO_PRODUCTS[indice]!;

  return {
    id: `demo-${indice + 1}`,
    slug,
    title: producto.title,
    subtitle: 'Contenido de marcador de posición',
    description:
      'Descripción de demostración. Al conectar el catálogo real, este texto sale de la ficha ' +
      'que se edita desde el panel, con su formato y sus imágenes.',
    brand: null,
    tags: ['demo'],
    seo_title: null,
    seo_description: null,
    rating_average: 0,
    rating_count: 0,
    images: [],
    options: [],
    variants: [
      {
        id: `demo-variant-${indice + 1}`,
        title: 'Estándar',
        sku: `DEMO-${String(indice + 1).padStart(3, '0')}`,
        price: producto.price,
        compare_at_price: producto.compareAt,
        option_values: {},
        is_default: true,
        available_quantity: 25,
        track_inventory: true,
      },
    ],
  };
}

/**
 * Páginas del CMS de demostración.
 *
 * El pie enlaza cinco: términos, privacidad, contacto, envíos y devoluciones, y
 * el checkout enlaza dos de ellas antes de confirmar. Sin base de datos las
 * cinco devolvían 404, así que el recorrido terminaba en una pantalla de error
 * justo donde una pasarela comprueba que el comercio informa de sus
 * condiciones.
 *
 * El texto es deliberadamente un marcador de posición y lo dice: son páginas
 * legales, y publicar una redacción inventada que parezca definitiva es peor
 * que no tener ninguna. El contenido real se redacta y se carga desde el panel.
 */
const DEMO_PAGES: { slug: string; title: string; bloques: [string, string][] }[] = [
  {
    slug: 'terminos',
    title: 'Términos y condiciones',
    bloques: [
      [
        'Qué regula esta página',
        'Las condiciones de venta son el contrato entre la tienda y quien compra. Aquí se fija en ' +
          'qué momento se considera cerrada una compra, qué pasa si un producto se queda sin stock ' +
          'después de pagarlo, y a qué se compromete cada parte. En la versión definitiva este texto ' +
          'lo revisa un abogado antes de publicarlo.',
      ],
      [
        'Precios e impuestos',
        'Todos los precios se muestran en dólares estadounidenses, que es la moneda de curso legal ' +
          'en Panamá junto al balboa. El ITBMS aplicable aparece desglosado en el resumen del pedido ' +
          'antes de confirmar, nunca como una sorpresa al final. El importe que se cobra es el que ' +
          'calcula el servidor: el navegador no puede alterarlo.',
      ],
      [
        'Confirmación y entrega',
        'Al confirmar un pedido se envía un correo con el número de referencia y el detalle de lo ' +
          'comprado. Ese número es el que sirve para cualquier consulta posterior. Los plazos de ' +
          'preparación y entrega se detallan en la página de envíos.',
      ],
      [
        'Cancelaciones y disputas',
        'Un pedido puede cancelarse mientras no haya salido del almacén. A partir de ahí se tramita ' +
          'como devolución. Cualquier reclamación se atiende primero por los canales de contacto de ' +
          'la tienda, y solo si no hay acuerdo se acude a la vía que corresponda.',
      ],
    ],
  },
  {
    slug: 'privacidad',
    title: 'Política de privacidad',
    bloques: [
      [
        'Qué regula esta página',
        'La Ley 81 de 2019 de Panamá obliga a informar de forma clara sobre el tratamiento de datos ' +
          'personales. Esta página explica qué se recoge, para qué, cuánto tiempo se conserva y cómo ' +
          'ejercer los derechos sobre esos datos.',
      ],
      [
        'Qué datos se recogen',
        'Para procesar un pedido hacen falta nombre, correo, teléfono y dirección de entrega. Si se ' +
          'crea una cuenta, se guarda además el historial de pedidos y las direcciones que se ' +
          'decidan almacenar. Nada de esto se pide antes de que sea necesario.',
      ],
      [
        'Datos de pago',
        'La tienda no ve ni guarda números de tarjeta en ningún momento. Los datos de pago se ' +
          'introducen directamente en la pasarela, que es quien está certificada para tratarlos. Lo ' +
          'único que vuelve a la tienda es la confirmación de que el cobro se realizó y por cuánto.',
      ],
      [
        'Derechos y contacto',
        'Cualquier persona puede pedir acceso a sus datos, su corrección o su eliminación, y también ' +
          'retirar el consentimiento para comunicaciones comerciales. La solicitud se atiende por el ' +
          'correo que figura en la página de contacto.',
      ],
    ],
  },
  {
    slug: 'devoluciones',
    title: 'Cambios y devoluciones',
    bloques: [
      [
        'Qué regula esta página',
        'Aquí se explica en qué plazo se puede devolver un producto, en qué estado debe llegar, ' +
          'quién asume el costo del envío de vuelta y en cuánto tiempo se reembolsa el dinero. Es una ' +
          'de las páginas que más se consulta antes de comprar, y una de las que revisa la pasarela ' +
          'de pago antes de aprobar un comercio.',
      ],
      [
        'Plazo y estado del producto',
        'El plazo habitual en este tipo de tienda va de siete a treinta días desde la entrega. El ' +
          'producto debe volver sin usar y con su empaque original. Los artículos personalizados y ' +
          'los de higiene suelen quedar excluidos, y conviene decirlo antes de la compra, no después.',
      ],
      [
        'Cómo se tramita',
        'La devolución se solicita desde el área de cliente o por los canales de contacto, indicando ' +
          'el número de pedido. A partir de ahí se emite una guía de retorno y se coordina la ' +
          'recogida o el envío.',
      ],
      [
        'Reembolsos',
        'El reembolso se hace por el mismo medio de pago usado en la compra, una vez recibido y ' +
          'revisado el producto. El tiempo hasta que aparece en la cuenta depende del banco emisor, ' +
          'no de la tienda.',
      ],
    ],
  },
  {
    slug: 'envios',
    title: 'Envíos',
    bloques: [
      [
        'Qué regula esta página',
        'Las zonas de cobertura, los tiempos de entrega, el costo por zona y el umbral a partir del ' +
          'cual el envío es gratis. Junto al precio, es lo que más decide una compra: una entrega sin ' +
          'plazo claro se abandona en el carrito.',
      ],
      [
        'Cobertura y plazos',
        'Una tienda en Panamá suele distinguir entre la ciudad, el interior y el envío internacional, ' +
          'con plazos distintos para cada zona. Los plazos se cuentan en días hábiles desde que el ' +
          'pedido sale del almacén, no desde que se paga.',
      ],
      [
        'Costo y envío gratis',
        'El costo se calcula por zona y peso, y se muestra en el checkout antes de confirmar. El ' +
          'umbral de envío gratis se configura desde el panel: en esta demostración está puesto en ' +
          '$50, que es el que aparece en la franja superior de la tienda.',
      ],
      [
        'Seguimiento',
        'Cada pedido enviado lleva un número de guía. El estado se consulta desde el área de cliente, ' +
          'y cada cambio genera un correo automático.',
      ],
    ],
  },
  {
    slug: 'contacto',
    title: 'Contacto',
    bloques: [
      [
        'Qué regula esta página',
        'Los canales de atención, el horario y el plazo de respuesta, además de los datos ' +
          'identificativos del comercio. Una tienda sin forma visible de contacto pierde ventas y no ' +
          'pasa la revisión de ninguna pasarela de pago.',
      ],
      [
        'Canales de atención',
        'Lo habitual es ofrecer correo, WhatsApp y un formulario, e indicar cuál es el más rápido. ' +
          'Los datos que aparecen en el pie de esta demostración son de ejemplo y se sustituyen por ' +
          'los reales desde el panel.',
      ],
      [
        'Horario y tiempo de respuesta',
        'Conviene comprometerse con un plazo concreto —por ejemplo, respuesta en menos de 24 horas ' +
          'hábiles— y con un horario de atención, para que nadie espere respuesta un domingo por la ' +
          'noche.',
      ],
      [
        'Datos del comercio',
        'Razón social, RUC y dirección fiscal. Son los datos que permiten identificar a quién se le ' +
          'está comprando, y los que exige cualquier proceso de verificación.',
      ],
    ],
  },
];

const AVISO_DEMO =
  'Esta página forma parte de una demostración de la plataforma. El texto de abajo explica qué irá ' +
  'en ella y por qué hace falta, pero no es un documento legal: la redacción definitiva la revisa ' +
  'un abogado y se carga desde el panel, en Contenido → Páginas, sin tocar código.';

export function getDemoPageSlugs(): string[] {
  return DEMO_PAGES.map((pagina) => pagina.slug);
}

export function getDemoPageBySlug(slug: string): CmsPage | null {
  const indice = DEMO_PAGES.findIndex((pagina) => pagina.slug === slug);
  if (indice === -1) return null;

  const pagina = DEMO_PAGES[indice]!;
  const fecha = '2026-01-01T00:00:00.000Z';

  return {
    id: `demo-pagina-${indice + 1}`,
    slug: pagina.slug,
    title: pagina.title,
    status: 'published',
    content: [
      { type: 'richtext', value: AVISO_DEMO },
      ...pagina.bloques.flatMap(([titulo, cuerpo]) => [
        { type: 'heading', value: titulo },
        { type: 'richtext', value: cuerpo },
      ]),
    ],
    seo_title: null,
    seo_description: null,
    published_at: fecha,
    created_by: null,
    created_at: fecha,
    updated_at: fecha,
  };
}

/**
 * Área de cliente en modo demostración.
 *
 * Sin Supabase, el layout de `/cuenta` cortaba en seco y las cuatro pantallas
 * —resumen, pedidos, direcciones y favoritos— se quedaban en una única frase
 * técnica, sin título siquiera. Es la mitad de la tienda que se le enseña a
 * quien va a comprar, y no se veía.
 *
 * Los tipos son a propósito estrechos y propios de la demostración: reproducir
 * las filas completas de la base de datos obligaría a inventarse decenas de
 * columnas que no se pintan en ninguna parte.
 */
export type DemoArticulo = { titulo: string; cantidad: number; total: number };

export type DemoPedido = {
  numero: string;
  fecha: string;
  estado: string;
  total: number;
  articulos: DemoArticulo[];
};

export type DemoDireccion = {
  nombre: string;
  linea1: string;
  linea2: string | null;
  ciudad: string;
  provincia: string;
  pais: string;
  telefono: string;
  predeterminada: boolean;
};

export const DEMO_CLIENTE = {
  nombre: 'Ana',
  pedidos: 3,
  totalGastado: 187.32,
};

export function getDemoPedidos(): DemoPedido[] {
  return [
    {
      numero: 'NB-2026-0148',
      fecha: '2026-08-14T16:20:00.000Z',
      estado: 'Entregado',
      total: 82.75,
      articulos: [
        { titulo: 'Producto destacado uno', cantidad: 2, total: 59.96 },
        { titulo: 'Producto destacado cuatro', cantidad: 1, total: 24.85 },
      ],
    },
    {
      numero: 'NB-2026-0131',
      fecha: '2026-07-29T11:05:00.000Z',
      estado: 'Enviado',
      total: 60.47,
      articulos: [
        { titulo: 'Producto destacado ocho', cantidad: 1, total: 44.77 },
        { titulo: 'Producto destacado dos', cantidad: 1, total: 23.8 },
      ],
    },
    {
      numero: 'NB-2026-0106',
      fecha: '2026-06-30T09:41:00.000Z',
      estado: 'En preparación',
      total: 44.1,
      articulos: [{ titulo: 'Producto destacado cinco', cantidad: 1, total: 32.9 }],
    },
  ];
}

export function getDemoDirecciones(): DemoDireccion[] {
  return [
    {
      nombre: 'Ana Rodríguez',
      linea1: 'Calle 50, Torre Global Bank, piso 12',
      linea2: 'Oficina 1204',
      ciudad: 'Ciudad de Panamá',
      provincia: 'Panamá',
      pais: 'PA',
      telefono: '+507 6000-0000',
      predeterminada: true,
    },
    {
      nombre: 'Ana Rodríguez',
      linea1: 'Avenida Central, Edificio Los Robles',
      linea2: null,
      ciudad: 'David',
      provincia: 'Chiriquí',
      pais: 'PA',
      telefono: '+507 6000-0001',
      predeterminada: false,
    },
  ];
}

/** Un subconjunto del catálogo, para que la rejilla de favoritos no salga vacía. */
export function getDemoFavoritos(): CatalogProduct[] {
  return getDemoProducts().slice(0, 4);
}
