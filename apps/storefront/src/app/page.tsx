import { Hero, NewsletterBand, ProductGrid, SectionHead, TrustBar } from '@nebula/ui';
import { toProductCards } from '@/lib/mappers';
import { getCtaBand, getFeaturedProducts, getHero } from '@/lib/storefront-data';

// El contenido de portada se revalida cada 5 minutos: el CMS puede cambiar
// banners sin esperar a un despliegue (ISR, brief §7).
export const revalidate = 300;

export default async function HomePage() {
  const [hero, catalogo, ctaBand] = await Promise.all([
    getHero(),
    getFeaturedProducts(10),
    getCtaBand(),
  ]);

  return (
    <>
      <Hero
        eyebrow={hero.eyebrow}
        title={hero.title}
        subtitle={hero.subtitle}
        ctaLabel={hero.ctaLabel ?? 'Ver ofertas'}
        ctaHref={hero.ctaHref ?? '/tienda'}
        mediaUrl={hero.mediaUrl}
      />

      <TrustBar />

      <section className="container section" id="catalogo">
        <SectionHead title="Más vendidos" linkLabel="Ver todo" linkHref="/tienda" />
        <ProductGrid
          products={toProductCards(catalogo.products)}
          emptyMessage={
            catalogo.degraded
              ? 'No pudimos cargar el catálogo en este momento. Vuelve a intentarlo en unos minutos.'
              : 'Todavía no hay productos publicados.'
          }
        />
      </section>

      <NewsletterBand
        title={ctaBand.title}
        subtitle={ctaBand.subtitle}
        ctaLabel={ctaBand.ctaLabel}
      />
    </>
  );
}
