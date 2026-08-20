import type { CatalogProduct } from '@nebula/db';

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
