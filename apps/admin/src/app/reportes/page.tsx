import { money, number, percent, shortDate } from '@nebula/ui';
import { BarChart, DataTable, StatCard, StatGrid } from '@nebula/ui/admin';
import {
  getConversionFunnel,
  getDashboardMetrics,
  getLowStock,
  getSalesDaily,
  getTopProducts,
} from '@nebula/db';
import { PanelPage } from '@/components/panel-page';
import { getSupabaseServerClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ dias?: string }>;
}) {
  const { dias } = await searchParams;
  const days = Math.min(Math.max(Number(dias ?? '30') || 30, 7), 365);

  const supabase = await getSupabaseServerClient();
  const [metrics, sales, topProducts, lowStock, funnel] = await Promise.all([
    getDashboardMetrics(supabase, days),
    getSalesDaily(supabase, days),
    getTopProducts(supabase, 10),
    getLowStock(supabase, 20),
    getConversionFunnel(supabase, 14),
  ]);

  // Conversión = carritos convertidos / carritos con artículos.
  const funnelTotals = funnel.reduce(
    (acc, day) => ({
      created: acc.created + Number(day.carts_created ?? 0),
      withItems: acc.withItems + Number(day.carts_with_items ?? 0),
      converted: acc.converted + Number(day.carts_converted ?? 0),
    }),
    { created: 0, withItems: 0, converted: 0 },
  );

  const conversionRate =
    funnelTotals.withItems > 0 ? (funnelTotals.converted / funnelTotals.withItems) * 100 : 0;

  return (
    <PanelPage title="Reportes" description={`Datos de los últimos ${days} días.`}>
      <form className="toolbar" action="/reportes" method="get">
        <label htmlFor="dias" style={{ fontSize: '0.82rem', fontWeight: 600 }}>
          Periodo
        </label>
        <select id="dias" name="dias" defaultValue={String(days)}>
          <option value="7">7 días</option>
          <option value="30">30 días</option>
          <option value="90">90 días</option>
          <option value="365">1 año</option>
        </select>
        <button type="submit" className="btn btn-outline btn-sm">
          Aplicar
        </button>
      </form>

      <StatGrid>
        <StatCard label="Ingresos" value={money(metrics.revenue)} />
        <StatCard label="Pedidos" value={number(metrics.orders_count)} />
        <StatCard label="Ticket medio" value={money(metrics.average_order_value)} />
        <StatCard
          label="Conversión de carrito"
          value={percent(conversionRate)}
          hint="Carritos con artículos que acaban en pedido"
        />
      </StatGrid>

      <div className="card">
        <div className="card-head">
          <h2>Ingresos por día</h2>
        </div>
        <BarChart
          points={sales.map((day) => ({
            label: shortDate(day.day).replace(/ de \d{4}/, ''),
            value: Number(day.revenue ?? 0),
          }))}
          formatValue={money}
        />
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-head">
            <h2>Productos más vendidos</h2>
          </div>
          <DataTable
            rows={topProducts}
            rowKey={(row) => row.product_id ?? row.title ?? ''}
            emptyMessage="Sin ventas registradas en el periodo."
            columns={[
              {
                key: 'title',
                header: 'Producto',
                render: (row) => <span className="cell-strong">{row.title}</span>,
              },
              {
                key: 'units',
                header: 'Unidades',
                align: 'right',
                render: (row) => number(Number(row.units_sold ?? 0)),
              },
              {
                key: 'revenue',
                header: 'Ingresos',
                align: 'right',
                render: (row) => money(Number(row.revenue ?? 0)),
              },
            ]}
          />
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Reposición pendiente</h2>
          </div>
          <DataTable
            rows={lowStock}
            rowKey={(row) => row.variant_id ?? ''}
            emptyMessage="Todo el inventario está por encima del umbral."
            columns={[
              {
                key: 'product',
                header: 'Producto',
                render: (row) => (
                  <div>
                    <span className="cell-strong">{row.product_title}</span>
                    <div className="cell-muted">{row.variant_title}</div>
                  </div>
                ),
              },
              {
                key: 'available',
                header: 'Disponible',
                align: 'right',
                render: (row) => (
                  <span className="tag tag-warning">{number(Number(row.available_quantity ?? 0))}</span>
                ),
              },
            ]}
          />
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Embudo de conversión (14 días)</h2>
        </div>
        <StatGrid>
          <StatCard label="Carritos creados" value={number(funnelTotals.created)} />
          <StatCard label="Con artículos" value={number(funnelTotals.withItems)} />
          <StatCard label="Convertidos en pedido" value={number(funnelTotals.converted)} />
        </StatGrid>
      </div>
    </PanelPage>
  );
}
