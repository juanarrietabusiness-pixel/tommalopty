import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@nebula/ui';
import { getProductBySlug, listPublishedProductSlugs } from '@nebula/db';
import { getSupabaseAnonClient, isSupabaseConfigured } from '@/lib/supabase';
import { getDemoProductBySlug } from '@/lib/demo-data';
import { ProductGallery } from '@/components/product-gallery';
import { ProductPurchasePanel } from '@/components/product-purchase-panel';

// ISR: la ficha se sirve estática y se regenera cada 10 minutos. Es la página
// que más pesa en SEO, por eso se prerenderiza (brief §7).
export const revalidate = 600;
export const dynamicParams = true;

export async function generateStaticParams() {
  if (!isSupabaseConfigured()) return [];

  try {
    const client = getSupabaseAnonClient();
    const slugs = await listPublishedProductSlugs(client);
    return slugs.slice(0, 200).map((entry) => ({ slug: entry.slug }));
  } catch {
    // Sin base de datos en tiempo de build, las fichas se generan bajo demanda.
    return [];
  }
}

async function loadProduct(slug: string) {
  // Sin base de datos, la ficha sale del contenido de demostración. Devolver
  // null aquí era un 404 en la página que más pesa de la tienda, enlazada
  // desde la portada y desde el catálogo.
  if (!isSupabaseConfigured()) return getDemoProductBySlug(slug);

  const client = getSupabaseAnonClient();
  return getProductBySlug(client, slug);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await loadProduct(slug);

  if (!product) return { title: 'Producto no encontrado' };

  return {
    title: product.seo_title ?? product.title,
    description: product.seo_description ?? product.subtitle ?? undefined,
    alternates: { canonical: `/producto/${product.slug}` },
    openGraph: {
      title: product.seo_title ?? product.title,
      description: product.seo_description ?? product.subtitle ?? undefined,
      images: product.images[0]?.url ? [product.images[0].url] : undefined,
      type: 'website',
    },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await loadProduct(slug);

  if (!product) notFound();

  const defaultVariant = product.variants[0];

  // Datos estructurados: Google los usa para mostrar precio y disponibilidad.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    description: product.description ?? product.subtitle ?? undefined,
    sku: defaultVariant?.sku ?? undefined,
    brand: product.brand ? { '@type': 'Brand', name: product.brand } : undefined,
    image: product.images.map((image) => image.url),
    offers: defaultVariant
      ? {
          '@type': 'Offer',
          price: defaultVariant.price,
          priceCurrency: 'USD',
          availability:
            !defaultVariant.track_inventory || defaultVariant.available_quantity > 0
              ? 'https://schema.org/InStock'
              : 'https://schema.org/OutOfStock',
        }
      : undefined,
  };

  return (
    <div className="container">
      <Breadcrumbs
        items={[
          { label: 'Inicio', href: '/' },
          { label: 'Tienda', href: '/tienda' },
          { label: product.title },
        ]}
      />

      <div className="product-detail">
        <ProductGallery images={product.images} title={product.title} />

        <div>
          {product.subtitle ? (
            <span className="hero-eyebrow" style={{ color: 'var(--color-muted)' }}>
              {product.subtitle}
            </span>
          ) : null}
          <h1>{product.title}</h1>
          <ProductPurchasePanel product={product} />
          {product.description ? (
            <div className="product-description" style={{ marginTop: 28 }}>
              {product.description}
            </div>
          ) : null}
        </div>
      </div>

      <script
        type="application/ld+json"
        // JSON.stringify no escapa `<`: una descripción con `</script>` cerraría
        // el bloque e inyectaría markup. El escape lo impide.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c'),
        }}
      />
    </div>
  );
}
