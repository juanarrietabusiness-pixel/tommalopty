import Link from 'next/link';
import { money, number, shortDate } from '@nebula/ui';
import { BarChart, DataTable, StatCard, StatGrid, StatusBadge } from '@nebula/ui/admin';
import { getDashboardMetrics, getLowStock, getSalesDaily, listOrders } from '@nebula/db';
import { PanelPage } from '@/components/panel-page';
import { getSupabaseServerClient, isSupabaseConfigured } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  if (!isSupabaseConfigured()) {
    return (
      <PanelPage title="Dashboard">
        <div className="notice notice-error">
          Falta configurar Supabase para este entorno. Copia <code>.env.example</code> a
          <code> .env.local</code> y añade las credenciales del proyecto.
        </div>
      </PanelPage>
    );
  }

  const supabase = await getSupabaseServerClient();
  const [metrics, sales, lowStock, recentOrders] = await Promise.all([
    getDashboardMetrics(supabase, 30),
    getSalesDaily(supabase, 14),
    getLowStock(supabase, 5),
    listOrders(supabase, { limit: 8 }),
  ]);

  return (
    <PanelPage title="Dashboard" description="Resumen de los últimos 30 días.">
      <StatGrid>
        <StatCard label="Ingresos" value={money(metrics.revenue)} hint="Pedidos pagados" />
        <StatCard label="Pedidos" value={number(metrics.orders_count)} hint="Creados en el periodo" />
        <StatCard label="Ticket medio" value={money(metrics.average_order_value)} />
        <StatCard label="Clientes nuevos" value={number(metrics.new_customers)} />
        <StatCard
          label="Pedidos pendientes"
          value={number(metrics.pending_orders)}
          hint="Requieren atención"
        />
        <StatCard
          label="Stock bajo"
          value={number(metrics.low_stock_items)}
          hint="Variantes por reponer"
        />
      </StatGrid>

      <div className="card">
        <div className="card-head">
          <h2>Ventas de los últimos 14 días</h2>
          <Link href="/reportes" className="btn btn-outline btn-sm">
            Ver reportes
          </Link>
        </div>
        <BarChart
          points={sales.map((day) => ({
            label: shortDate(day.day).replace(/ de \d{4}/, ''),
            value: Number(day.revenue ?? 0),
          }))}
          formatValue={money}
        />
      </div>

      <div className="grid-sidebar">
        <div className="card">
          <div className="card-head">
            <h2>Pedidos recientes</h2>
            <Link href="/pedidos" className="btn btn-outline btn-sm">
              Ver todos
            </Link>
          </div>
          <DataTable
            rows={recentOrders.orders}
            rowKey={(order) => order.id}
            emptyMessage="Todavía no hay pedidos."
            columns={[
              {
                key: 'number',
                header: 'Pedido',
                render: (order) => (
                  <Link href={`/pedidos/${order.id}`} className="cell-strong">
                    {order.order_number}
                  </Link>
                ),
              },
              { key: 'email', header: 'Cliente', render: (order) => order.email },
              {
                key: 'status',
                header: 'Estado',
                render: (order) => <StatusBadge kind="order" value={order.status} />,
              },
              {
                key: 'payment',
                header: 'Pago',
                render: (order) => <StatusBadge kind="payment" value={order.payment_status} />,
              },
              {
                key: 'total',
                header: 'Total',
                align: 'right',
                render: (order) => money(order.total),
              },
            ]}
          />
        </div>

        <div className="card">
          <div className="card-head">
            <h3>Stock bajo</h3>
          </div>
          {lowStock.length === 0 ? (
            <p className="field-hint">Todo el inventario está por encima del umbral.</p>
          ) : (
            <ul>
              {lowStock.map((item) => (
                <li
                  key={item.variant_id}
                  style={{ padding: '10px 0', borderBottom: '1px solid var(--color-border)' }}
                >
                  <strong style={{ fontSize: '0.84rem' }}>{item.product_title}</strong>
                  <div className="field-hint">
                    {item.variant_title} · quedan {item.available_quantity}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </PanelPage>
  );
}
