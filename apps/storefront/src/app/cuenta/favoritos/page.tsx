import type { Metadata } from 'next';
import Link from 'next/link';
import { ProductGrid } from '@nebula/ui';
import { getSupabaseServerClient } from '@/lib/supabase';
import { toProductCards } from '@/lib/mappers';
import type { CatalogProduct } from '@nebula/db';

export const metadata: Metadata = {
  title: 'Favoritos',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function WishlistPage() {
  const supabase = await getSupabaseServerClient();

  // RLS limita `wishlists` al cliente autenticado, así que no hace falta filtrar.
  const { data: wishlist } = await supabase
    .from('wishlists')
    .select('id, wishlist_items (product_id)')
    .limit(1)
    .maybeSingle();

  const productIds = (wishlist?.wishlist_items ?? []).map((item) => item.product_id);

  let products: CatalogProduct[] = [];
  if (productIds.length > 0) {
    const { data } = await supabase
      .from('product_catalog')
      .select('*')
      .in('id', productIds)
      .eq('status', 'active');
    products = data ?? [];
  }

  return (
    <>
      <h1 className="page-title">Favoritos</h1>
      <p className="page-subtitle">Los productos que has guardado para más adelante.</p>

      {products.length === 0 ? (
        <p className="field-hint">
          Todavía no has guardado productos. <Link href="/tienda">Explora la tienda</Link>.
        </p>
      ) : (
        <ProductGrid products={toProductCards(products)} columns={4} />
      )}
    </>
  );
}
