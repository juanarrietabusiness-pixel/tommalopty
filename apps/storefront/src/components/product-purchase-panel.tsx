'use client';

import { useMemo, useState } from 'react';
import { QuantityStepper, money, useCart } from '@nebula/ui';
import type { ProductDetail } from '@nebula/db';
import { trackPixelEvent } from './meta-pixel';

/**
 * Selección de variante, cantidad y añadido al carrito.
 *
 * Vive en cliente porque toca el estado del carrito; el resto de la ficha se
 * renderiza en servidor para que el SEO no dependa de JavaScript.
 */
export function ProductPurchasePanel({ product }: { product: ProductDetail }) {
  const { addLine } = useCart();
  const [selectedVariantId, setSelectedVariantId] = useState(
    product.variants[0]?.id ?? '',
  );
  const [quantity, setQuantity] = useState(1);

  const variant = useMemo(
    () => product.variants.find((candidate) => candidate.id === selectedVariantId),
    [product.variants, selectedVariantId],
  );

  if (!variant) {
    return <p className="notice notice-error">Este producto no tiene variantes disponibles.</p>;
  }

  const outOfStock = variant.track_inventory && variant.available_quantity <= 0;
  const lowStock =
    variant.track_inventory && variant.available_quantity > 0 && variant.available_quantity <= 5;
  const maxQuantity = variant.track_inventory ? variant.available_quantity : null;

  function handleAdd() {
    if (!variant || outOfStock) return;

    addLine({
      variantId: variant.id,
      productId: product.id,
      slug: product.slug,
      title: product.title,
      variantTitle: variant.title,
      price: variant.price,
      compareAtPrice: variant.compare_at_price,
      imageUrl: product.images[0]?.url ?? null,
      quantity,
      maxQuantity,
    });

    // El mismo evento se envía en servidor vía Conversions API al confirmar
    // el pedido; aquí basta con la señal de cliente.
    trackPixelEvent('AddToCart', `add-${variant.id}-${Date.now()}`, {
      content_ids: [variant.sku ?? variant.id],
      content_type: 'product',
      value: variant.price * quantity,
      currency: 'USD',
    });
  }

  return (
    <>
      <div className="price-block">
        <span className="price-sale">{money(variant.price)}</span>
        {variant.compare_at_price && variant.compare_at_price > variant.price ? (
          <span className="price-regular">{money(variant.compare_at_price)}</span>
        ) : null}
      </div>

      {product.variants.length > 1 ? (
        <div className="variant-options">
          <h3>Opciones</h3>
          <div className="variant-choices">
            {product.variants.map((candidate) => (
              <button
                key={candidate.id}
                type="button"
                className="variant-choice"
                aria-pressed={candidate.id === selectedVariantId}
                disabled={candidate.track_inventory && candidate.available_quantity <= 0}
                onClick={() => {
                  setSelectedVariantId(candidate.id);
                  setQuantity(1);
                }}
              >
                {candidate.title}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <p
        className={`stock-line ${outOfStock ? 'stock-out' : lowStock ? 'stock-low' : 'stock-in'}`}
      >
        {outOfStock
          ? 'Agotado temporalmente'
          : lowStock
            ? `¡Quedan solo ${variant.available_quantity} unidades!`
            : 'Disponible'}
      </p>

      <div className="buy-row">
        <QuantityStepper value={quantity} onChange={setQuantity} max={maxQuantity} />
        <button type="button" className="btn btn-dark" onClick={handleAdd} disabled={outOfStock}>
          {outOfStock ? 'Sin stock' : 'Añadir al carrito'}
        </button>
      </div>

      <div className="product-meta">
        {variant.sku ? <span>SKU: {variant.sku}</span> : null}
        {product.brand ? <span>Marca: {product.brand}</span> : null}
      </div>
    </>
  );
}
