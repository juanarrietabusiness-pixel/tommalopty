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
const DEMO_PAGES: { slug: string; title: string; intro: string }[] = [
  {
    slug: 'terminos',
    title: 'Términos y condiciones',
    intro:
      'Aquí van las condiciones de venta: formación del contrato, precios, impuestos, plazos y ' +
      'resolución de disputas.',
  },
  {
    slug: 'privacidad',
    title: 'Política de privacidad',
    intro:
      'Aquí va el tratamiento de datos personales que exige la Ley 81 de 2019: qué se recoge, ' +
      'con qué finalidad, cuánto se conserva y cómo se ejercen los derechos.',
  },
  {
    slug: 'devoluciones',
    title: 'Cambios y devoluciones',
    intro:
      'Aquí van los plazos para devolver, el estado en que debe llegar el producto, quién paga ' +
      'el envío de vuelta y en cuánto tiempo se reembolsa.',
  },
  {
    slug: 'envios',
    title: 'Envíos',
    intro:
      'Aquí van las zonas de cobertura, los tiempos de entrega, el costo por zona y el umbral a ' +
      'partir del cual el envío es gratis.',
  },
  {
    slug: 'contacto',
    title: 'Contacto',
    intro:
      'Aquí van los canales de atención, el horario y el plazo de respuesta, además de la ' +
      'dirección fiscal del comercio.',
  },
];

const AVISO_DEMO =
  'Esta página es una demostración de la plataforma: el texto es un marcador de posición, no un ' +
  'documento legal. Al conectar la base de datos, este contenido se redacta y se edita desde el ' +
  'panel, en Contenido → Páginas, sin tocar código.';

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
      { type: 'heading', value: 'Qué irá en esta página' },
      { type: 'richtext', value: pagina.intro },
    ],
    seo_title: null,
    seo_description: null,
    published_at: fecha,
    created_by: null,
    created_at: fecha,
    updated_at: fecha,
  };
}
