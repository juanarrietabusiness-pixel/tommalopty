import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PanelPage } from '@/components/panel-page';
import { ProductForm, type ProductFormValues } from '@/components/product-form';
import { ProductImages } from '@/components/product-images';
import { cargarProducto } from '@/lib/panel-data';

export const dynamic = 'force-dynamic';

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await cargarProducto(id);
  if (!product) notFound();

  const initial: ProductFormValues = {
    id: product.id,
    title: product.title,
    slug: product.slug,
    subtitle: product.subtitle ?? '',
    description: product.description ?? '',
    brand: product.brand ?? '',
    status: product.status,
    isFeatured: product.isFeatured,
    tags: product.tags.join(', '),
    price: product.price ?? 0,
    compareAtPrice: product.compareAtPrice,
    sku: product.sku ?? '',
    quantity: product.quantity ?? 0,
    seoTitle: product.seoTitle ?? '',
    seoDescription: product.seoDescription ?? '',
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
      <div className="grid-sidebar">
        <ProductForm initial={initial} />
        <ProductImages productId={product.id} images={product.images} />
      </div>
    </PanelPage>
  );
}
