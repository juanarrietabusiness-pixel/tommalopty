import { ProductCard, type ProductCardData } from './product-card';
import { ImagePlaceholderIcon } from './icons';

export interface ProductGridProps {
  products: ProductCardData[];
  columns?: 4 | 5;
  emptyMessage?: string;
}

export function ProductGrid({ products, columns = 5, emptyMessage }: ProductGridProps) {
  if (products.length === 0) {
    return (
      <div className="empty-state">
        <ImagePlaceholderIcon />
        <p>{emptyMessage ?? 'No hay productos que coincidan con tu búsqueda.'}</p>
      </div>
    );
  }

  return (
    <div className="product-grid" data-columns={columns}>
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
