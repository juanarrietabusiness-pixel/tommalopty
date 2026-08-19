import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PanelPage } from '@/components/panel-page';
import { ProductForm, type ProductFormValues } from '@/components/product-form';
import { getSupabaseServerClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getSupabaseServerClient();

  const { data: product } = await supabase
    .from('products')
    .select(
      `id, title, slug, subtitle, description, brand, status, is_featured, tags,
       seo_title, seo_description,
       product_variants (id, price, compare_at_price, sku, is_default,
         inventory (quantity))`,
    )
    .eq('id', id)
    .maybeSingle();

  if (!product) notFound();

  const variant =
    product.product_variants?.find((candidate) => candidate.is_default) ??
    product.product_variants?.[0];
  const inventory = Array.isArray(variant?.inventory) ? variant?.inventory[0] : variant?.inventory;

  const initial: ProductFormValues = {
    id: product.id,
    title: product.title,
    slug: product.slug,
    subtitle: product.subtitle ?? '',
    description: product.description ?? '',
    brand: product.brand ?? '',
    status: product.status,
    isFeatured: product.is_featured,
    tags: product.tags.join(', '),
    price: variant?.price ?? 0,
    compareAtPrice: variant?.compare_at_price ?? null,
    sku: variant?.sku ?? '',
    quantity: inventory?.quantity ?? 0,
    seoTitle: product.seo_title ?? '',
    seoDescription: product.seo_description ?? '',
  };

  const storefrontUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

  return (
    <PanelPage
      title={product.title}
      description={`Editando /producto/${product.slug}`}
      actions={
        product.status === 'active' ? (
          <Link
            href={`${storefrontUrl}/producto/${product.slug}`}
            target="_blank"
            rel="noreferrer noopener"
            className="btn btn-outline btn-sm"
          >
            Ver en la tienda
          </Link>
        ) : null
      }
    >
      <ProductForm initial={initial} />
    </PanelPage>
  );
}
