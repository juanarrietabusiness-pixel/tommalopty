import { PanelPage } from '@/components/panel-page';
import { ProductForm } from '@/components/product-form';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function NewProductPage() {
  await requireAdmin();

  return (
    <PanelPage
      title="Nuevo producto"
      description="Se creará con una variante por defecto; podrás añadir más desde la ficha."
    >
      <ProductForm />
    </PanelPage>
  );
}
