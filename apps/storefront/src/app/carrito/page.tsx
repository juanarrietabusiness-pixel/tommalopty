import type { Metadata } from 'next';
import { Breadcrumbs } from '@nebula/ui';
import { CartPageContent } from '@/components/cart-page-content';

export const metadata: Metadata = {
  title: 'Carrito',
  robots: { index: false, follow: false },
};

export default function CartPage() {
  return (
    <div className="container">
      <Breadcrumbs items={[{ label: 'Inicio', href: '/' }, { label: 'Carrito' }]} />
      <h1 className="page-title" style={{ marginTop: 24 }}>
        Tu carrito
      </h1>
      <CartPageContent />
    </div>
  );
}
