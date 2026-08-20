'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useCart } from '../cart/cart-context';
import { money } from '../lib/format';
import { ImagePlaceholderIcon } from './icons';

/**
 * Forma mínima que necesita la tarjeta. Coincide con la vista
 * `public.product_catalog`, pero se declara aquí para que el paquete de UI no
 * dependa del esquema de base de datos.
 */
export interface ProductCardData {
  id: string;
  slug: string;
  title: string;
  price: number;
  compareAtPrice?: number | null;
  imageUrl?: string | null;
  imageAlt?: string | null;
  defaultVariantId?: string | null;
  onSale?: boolean;
  availableQuantity?: number | null;
  trackInventory?: boolean;
}

export function ProductCard({ product }: { product: ProductCardData }) {
  const { addLine } = useCart();
  const [justAdded, setJustAdded] = useState(false);

  const outOfStock = product.trackInventory === true && (product.availableQuantity ?? 0) <= 0;
  const canAdd = Boolean(product.defaultVariantId) && !outOfStock;

  function handleAdd() {
    if (!product.defaultVariantId || !canAdd) return;

    addLine({
      variantId: product.defaultVariantId,
      productId: product.id,
      slug: product.slug,
      title: product.title,
      price: product.price,
      compareAtPrice: product.compareAtPrice ?? null,
      imageUrl: product.imageUrl ?? null,
      quantity: 1,
      maxQuantity: product.trackInventory ? (product.availableQuantity ?? 0) : null,
    });

    setJustAdded(true);
    window.setTimeout(() => setJustAdded(false), 1200);
  }

  return (
    <article className="product-card" data-id={product.id}>
      <Link href={`/producto/${product.slug}`} className="product-media" aria-label={product.title}>
        {product.onSale ? <span className="badge-offer">Oferta</span> : null}
        {outOfStock ? <span className="badge-soldout">Agotado</span> : null}
        {product.imageUrl ? (
          // <img> en lugar de next/image: el catálogo sirve desde R2/Supabase Storage
          // con dominios configurables por entorno, que next/image exigiría fijar en build.
          <img src={product.imageUrl} alt={product.imageAlt ?? product.title} loading="lazy" />
        ) : (
          <ImagePlaceholderIcon className="placeholder-icon" />
        )}
      </Link>

      <div className="product-info">
        <p className="product-title">
          <Link href={`/producto/${product.slug}`}>{product.title}</Link>
        </p>
        <div className="product-price">
          <span className="price-sale">{money(product.price)}</span>
          {product.compareAtPrice && product.compareAtPrice > product.price ? (
            <span className="price-regular">{money(product.compareAtPrice)}</span>
          ) : null}
        </div>
        <button
          type="button"
          className={`btn-add${justAdded ? ' added' : ''}`}
          onClick={handleAdd}
          disabled={!canAdd}
        >
          {outOfStock ? 'Agotado' : justAdded ? 'Añadido ✓' : 'Añadir'}
        </button>
      </div>
    </article>
  );
}
