import type { Metadata } from 'next';
import { ProductGrid, SectionHead } from '@nebula/ui';
import { searchProducts } from '@nebula/db';
import { getSupabaseServerClient, isSupabaseConfigured } from '@/lib/supabase';
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
    term && isSupabaseConfigured()
      ? await searchProducts(await getSupabaseServerClient(), term, 40)
      : [];

  return (
    <div className="container section">
      <SectionHead title={term ? `Resultados para "${term}"` : 'Buscar en la tienda'} />

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
          style={{
            flex: 1,
            padding: '13px 18px',
            borderRadius: 999,
            border: '1px solid var(--color-border)',
            fontSize: '0.9rem',
          }}
        />
        <button type="submit" className="btn btn-dark btn-sm">
          Buscar
        </button>
      </form>

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
