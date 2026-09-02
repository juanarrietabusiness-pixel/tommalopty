import type { Metadata } from 'next';
import { ProductGrid, SectionHead } from '@nebula/ui';
import { searchProducts } from '@nebula/db';
import { getSupabaseAnonClient, isSupabaseConfigured } from '@/lib/supabase';
import { EventoDePagina } from '@/components/eventos-de-pagina';
import { toProductCards } from '@/lib/mappers';

export const metadata: Metadata = {
  title: 'Buscar',
  robots: { index: false, follow: true },
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = '' } = await searchParams;
  const term = q.trim();

  const products =
    term && isSupabaseConfigured() ? await searchProducts(getSupabaseAnonClient(), term, 40) : [];

  return (
    <div className="container section">
      <SectionHead title={term ? `Resultados para "${term}"` : 'Buscar en la tienda'} as="h1" />

      <form action="/buscar" method="get" className="toolbar" style={{ marginBottom: 28 }}>
        <label className="visually-hidden" htmlFor="q">
          Buscar productos
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={term}
          placeholder="¿Qué estás buscando?"
          className="buscador-campo"
        />
        <button type="submit" className="btn btn-dark btn-sm">
          Buscar
        </button>
      </form>

      {/* Search: le dice a Meta qué busca la gente y si encuentra algo. Una
          búsqueda sin resultados es una señal comercial —hay demanda de algo que
          no está en catálogo— y hasta hoy se perdía entera.

          El `event_id` sale del término, así que recargar la misma búsqueda no
          la cuenta dos veces. */}
      {term ? (
        <EventoDePagina
          evento="Search"
          eventId={`search-${term.toLowerCase()}`}
          datos={{
            search_string: term,
            content_type: 'product',
            content_ids: products.slice(0, 10).map((p) => p.id),
          }}
        />
      ) : null}

      {term ? (
        <ProductGrid
          products={toProductCards(products)}
          columns={4}
          emptyMessage={`No encontramos productos para "${term}". Prueba con otra palabra.`}
        />
      ) : (
        <p className="field-hint">Escribe una palabra para buscar en el catálogo.</p>
      )}
    </div>
  );
}
