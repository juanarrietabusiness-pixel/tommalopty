import type { CatalogProduct } from '@nebula/db';
import type { ProductCardData } from '@nebula/ui';

/**
 * La vista `product_catalog` declara casi todas sus columnas como nullable
 * (es una vista con LEFT JOINs). Aquí se normaliza a la forma que espera la
 * tarjeta de producto, en un único punto.
 */
export function toProductCardData(product: CatalogProduct): ProductCardData {
  return {
    id: product.id ?? '',
    slug: product.slug ?? '',
    title: product.title ?? '',
    price: product.price ?? 0,
    compareAtPrice: product.compare_at_price,
    imageUrl: product.image_url,
    imageAlt: product.image_alt,
    defaultVariantId: product.default_variant_id,
    onSale: product.on_sale ?? false,
    availableQuantity: product.available_quantity,
    trackInventory: product.track_inventory ?? false,
  };
}

export function toProductCards(products: CatalogProduct[]): ProductCardData[] {
  return products.map(toProductCardData);
}
