import { number } from '@nebula/ui';
import { DataTable } from '@nebula/ui/admin';
import { PanelPage } from '@/components/panel-page';
import { InventoryRowForm } from '@/components/inventory-form';
import { getSupabaseServerClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export default async function InventoryPage() {
  const supabase = await getSupabaseServerClient();

  const { data } = await supabase
    .from('inventory')
    .select(
      'variant_id, quantity, reserved_quantity, low_stock_threshold, product_variants (title, sku, products (title))',
    )
    .order('quantity')
    .limit(200);

  const rows = (data ?? []).map((entry) => {
    const variant = Array.isArray(entry.product_variants)
      ? entry.product_variants[0]
      : entry.product_variants;
    const product = Array.isArray(variant?.products) ? variant?.products[0] : variant?.products;

    return {
      variantId: entry.variant_id,
      productTitle: product?.title ?? 'Producto',
      variantTitle: variant?.title ?? 'Estándar',
      sku: variant?.sku ?? null,
      quantity: entry.quantity,
      reserved: entry.reserved_quantity,
      available: Math.max(entry.quantity - entry.reserved_quantity, 0),
      threshold: entry.low_stock_threshold,
    };
  });

  return (
    <PanelPage
      title="Inventario"
      description="Disponible = stock − reservado en pedidos sin cumplir. El segundo campo es el umbral de alerta."
    >
      <DataTable
        rows={rows}
        rowKey={(row) => row.variantId}
        emptyMessage="No hay variantes con inventario."
        columns={[
          {
            key: 'product',
            header: 'Producto',
            render: (row) => (
              <div>
                <span className="cell-strong">{row.productTitle}</span>
                <div className="cell-muted">
                  {row.variantTitle}
                  {row.sku ? ` · ${row.sku}` : ''}
                </div>
              </div>
            ),
          },
          { key: 'reserved', header: 'Reservado', align: 'right', render: (row) => number(row.reserved) },
          {
            key: 'available',
            header: 'Disponible',
            align: 'right',
            render: (row) =>
              row.available <= row.threshold ? (
                <span className="tag tag-warning">{number(row.available)}</span>
              ) : (
                number(row.available)
              ),
          },
          {
            key: 'adjust',
            header: 'Stock · umbral',
            render: (row) => (
              <InventoryRowForm
                variantId={row.variantId}
                quantity={row.quantity}
                lowStockThreshold={row.threshold}
              />
            ),
          },
        ]}
      />
    </PanelPage>
  );
}
