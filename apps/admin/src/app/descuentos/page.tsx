import { money, number, shortDate } from '@nebula/ui';
import { DataTable } from '@nebula/ui/admin';
import { PanelPage } from '@/components/panel-page';
import { DiscountForm } from '@/components/discount-form';
import { InterruptorDeFila } from '@/components/interruptor-de-fila';
import { cargarDescuentos } from '@/lib/panel-data';
import { toggleDiscount } from '@/lib/actions/catalog-extra';

export const dynamic = 'force-dynamic';

const TYPE_LABELS: Record<string, string> = {
  percentage: 'Porcentaje',
  fixed_amount: 'Importe fijo',
  free_shipping: 'Envío gratis',
};

export default async function DiscountsPage() {
  const discounts = await cargarDescuentos();

  return (
    <PanelPage
      title="Descuentos"
      description="Los códigos no son legibles desde la tienda: el checkout los valida vía RPC, así nadie puede enumerarlos."
    >
      <div className="grid-sidebar">
        <DataTable
          rows={discounts ?? []}
          rowKey={(discount) => discount.id}
          emptyMessage="Todavía no hay descuentos."
          columns={[
            {
              key: 'code',
              header: 'Código',
              render: (discount) => <span className="cell-strong">{discount.code}</span>,
            },
            {
              key: 'type',
              header: 'Tipo',
              render: (discount) => TYPE_LABELS[discount.type] ?? discount.type,
            },
            {
              key: 'value',
              header: 'Valor',
              align: 'right',
              render: (discount) =>
                discount.type === 'percentage'
                  ? `${discount.value}%`
                  : discount.type === 'free_shipping'
                    ? '—'
                    : money(discount.value),
            },
            {
              key: 'usage',
              header: 'Usos',
              align: 'right',
              render: (discount) =>
                `${number(discount.usage_count)}${discount.usage_limit ? ` / ${discount.usage_limit}` : ''}`,
            },
            {
              key: 'ends',
              header: 'Caduca',
              render: (discount) => (
                <span className="cell-muted">
                  {discount.ends_at ? shortDate(discount.ends_at) : 'Sin caducidad'}
                </span>
              ),
            },
            {
              key: 'active',
              header: 'Estado',
              render: (discount) =>
                discount.is_active ? (
                  <span className="tag tag-success">Activo</span>
                ) : (
                  <span className="tag">Inactivo</span>
                ),
            },
            {
              key: 'acciones',
              header: '',
              align: 'right',
              render: (discount) => (
                <InterruptorDeFila
                  activo={discount.is_active}
                  nombre={`el código ${discount.code}`}
                  alCambiar={toggleDiscount.bind(null, discount.id)}
                />
              ),
            },
          ]}
        />
        <DiscountForm />
      </div>
    </PanelPage>
  );
}
