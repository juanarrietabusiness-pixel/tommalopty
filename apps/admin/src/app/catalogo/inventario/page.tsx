import { number } from '@nebula/ui';
import { DataTable } from '@nebula/ui/admin';
import { PanelPage } from '@/components/panel-page';
import { InventoryRowForm } from '@/components/inventory-form';
import { cargarInventario } from '@/lib/panel-data';

export const dynamic = 'force-dynamic';

export default async function InventoryPage() {
  const rows = await cargarInventario();

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
          {
            key: 'reserved',
            header: 'Reservado',
            align: 'right',
            render: (row) => number(row.reserved),
          },
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
