import type { Metadata } from 'next';
import Link from 'next/link';
import { Breadcrumbs, ProductGrid, SectionHead } from '@nebula/ui';
import { listCategories, listProducts } from '@nebula/db';
import { getSupabaseServerClient, isSupabaseConfigured } from '@/lib/supabase';
import { getDemoProducts } from '@/lib/demo-data';
import { toProductCards } from '@/lib/mappers';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Tienda',
  description: 'Explora todo el catálogo, filtra por categoría y encuentra las ofertas activas.',
};

const PAGE_SIZE = 20;

interface SearchParams {
  categoria?: string;
  filtro?: string;
  orden?: string;
  pagina?: string;
}

function parseSort(value: string | undefined) {
  switch (value) {
    case 'precio-asc':
      return 'price_asc' as const;
    case 'precio-desc':
      return 'price_desc' as const;
    case 'valoracion':
      return 'rating' as const;
    default:
      return 'recent' as const;
  }
}

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.pagina ?? '1') || 1);
  const offset = (page - 1) * PAGE_SIZE;

  if (!isSupabaseConfigured()) {
    const demo = getDemoProducts();
    return (
      <div className="container">
        <Breadcrumbs items={[{ label: 'Inicio', href: '/' }, { label: 'Tienda' }]} />
        <section className="section">
          <SectionHead title="Tienda" />
          <p className="notice notice-info">
            Mostrando el catálogo de demostración: todavía no hay una instancia de Supabase
            configurada para este entorno.
          </p>
          <ProductGrid products={toProductCards(demo)} columns={4} />
        </section>
      </div>
    );
  }

  const client = await getSupabaseServerClient();
  const [categories, { products, total }] = await Promise.all([
    listCategories(client),
    listProducts(client, {
      categorySlug: params.categoria,
      onSaleOnly: params.filtro === 'ofertas',
      featuredOnly: params.filtro === 'novedades',
      sort: parseSort(params.orden),
      limit: PAGE_SIZE,
      offset,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const activeCategory = categories.find((category) => category.slug === params.categoria);

  function buildHref(overrides: Partial<SearchParams>): string {
    const next = new URLSearchParams();
    const merged = { ...params, ...overrides };
    if (merged.categoria) next.set('categoria', merged.categoria);
    if (merged.filtro) next.set('filtro', merged.filtro);
    if (merged.orden) next.set('orden', merged.orden);
    if (merged.pagina && merged.pagina !== '1') next.set('pagina', merged.pagina);
    const query = next.toString();
    return query ? `/tienda?${query}` : '/tienda';
  }

  return (
    <div className="container">
      <Breadcrumbs
        items={[
          { label: 'Inicio', href: '/' },
          { label: 'Tienda', href: activeCategory ? '/tienda' : undefined },
          ...(activeCategory ? [{ label: activeCategory.name }] : []),
        ]}
      />

      <section className="section">
        <SectionHead title={activeCategory?.name ?? 'Todos los productos'} />

        <div className="catalog-layout">
          <aside className="filters">
            <div className="filters-group">
              <h3>Categorías</h3>
              <ul>
                <li>
                  <Link
                    href={buildHref({ categoria: undefined, pagina: '1' })}
                    aria-current={!params.categoria ? 'true' : undefined}
                  >
                    Todas
                  </Link>
                </li>
                {categories.map((category) => (
                  <li key={category.id}>
                    <Link
                      href={buildHref({ categoria: category.slug, pagina: '1' })}
                      aria-current={params.categoria === category.slug ? 'true' : undefined}
                    >
                      {category.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div className="filters-group">
              <h3>Filtros</h3>
              <ul>
                <li>
                  <Link
                    href={buildHref({ filtro: undefined, pagina: '1' })}
                    aria-current={!params.filtro ? 'true' : undefined}
                  >
                    Sin filtro
                  </Link>
                </li>
                <li>
                  <Link
                    href={buildHref({ filtro: 'ofertas', pagina: '1' })}
                    aria-current={params.filtro === 'ofertas' ? 'true' : undefined}
                  >
                    En oferta
                  </Link>
                </li>
                <li>
                  <Link
                    href={buildHref({ filtro: 'novedades', pagina: '1' })}
                    aria-current={params.filtro === 'novedades' ? 'true' : undefined}
                  >
                    Novedades
                  </Link>
                </li>
              </ul>
            </div>

            <div className="filters-group">
              <h3>Ordenar por</h3>
              <ul>
                <li>
                  <Link href={buildHref({ orden: undefined })}>Más recientes</Link>
                </li>
                <li>
                  <Link href={buildHref({ orden: 'precio-asc' })}>Precio: menor a mayor</Link>
                </li>
                <li>
                  <Link href={buildHref({ orden: 'precio-desc' })}>Precio: mayor a menor</Link>
                </li>
                <li>
                  <Link href={buildHref({ orden: 'valoracion' })}>Mejor valorados</Link>
                </li>
              </ul>
            </div>
          </aside>

          <div>
            <div className="catalog-toolbar">
              <span className="catalog-count">
                {total} {total === 1 ? 'producto' : 'productos'}
              </span>
            </div>

            <ProductGrid products={toProductCards(products)} columns={4} />

            {totalPages > 1 ? (
              <nav className="pagination" aria-label="Paginación">
                {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
                  <Link
                    key={pageNumber}
                    href={buildHref({ pagina: String(pageNumber) })}
                    aria-current={pageNumber === page ? 'page' : undefined}
                  >
                    {pageNumber}
                  </Link>
                ))}
              </nav>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
