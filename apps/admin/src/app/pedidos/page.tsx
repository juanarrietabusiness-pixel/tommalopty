import Link from 'next/link';
import { money, shortDate } from '@nebula/ui';
import { DataTable, StatusBadge } from '@nebula/ui/admin';
import { listOrders } from '@nebula/db';
import { PanelPage } from '@/components/panel-page';
import { getSupabaseServerClient } from '@/lib/supabase';
import { ORDER_STATUSES, PAYMENT_STATUSES, parseEnumParam } from '@/lib/query-params';

export const dynamic = 'force-dynamic';

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; estado?: string; pago?: string }>;
}) {
  const params = await searchParams;
  const supabase = await getSupabaseServerClient();

  const { orders, total } = await listOrders(supabase, {
    search: params.q,
    status: parseEnumParam(params.estado, ORDER_STATUSES),
    paymentStatus: parseEnumParam(params.pago, PAYMENT_STATUSES),
    limit: 50,
  });

  return (
    <PanelPage title="Pedidos" description={`${total} pedidos registrados.`}>
      <form className="toolbar" action="/pedidos" method="get">
        <input
          type="search"
          name="q"
          defaultValue={params.q ?? ''}
          placeholder="Buscar por número o email…"
        />
        <select name="estado" defaultValue={params.estado ?? ''}>
          <option value="">Todos los estados</option>
          <option value="pending">Pendiente</option>
          <option value="confirmed">Confirmado</option>
          <option value="processing">En preparación</option>
          <option value="shipped">Enviado</option>
          <option value="delivered">Entregado</option>
          <option value="cancelled">Cancelado</option>
        </select>
        <select name="pago" defaultValue={params.pago ?? ''}>
          <option value="">Cualquier pago</option>
          <option value="pending">Pago pendiente</option>
          <option value="paid">Pagado</option>
          <option value="failed">Fallido</option>
          <option value="refunded">Reembolsado</option>
        </select>
        <button type="submit" className="btn btn-outline btn-sm">
          Filtrar
        </button>
      </form>

      <DataTable
        rows={orders}
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
          {
            key: 'date',
            header: 'Fecha',
            render: (order) => <span className="cell-muted">{shortDate(order.created_at)}</span>,
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
            key: 'fulfillment',
            header: 'Preparación',
            render: (order) => <StatusBadge kind="fulfillment" value={order.fulfillment_status} />,
          },
          {
            key: 'total',
            header: 'Total',
            align: 'right',
            render: (order) => <span className="cell-strong">{money(order.total)}</span>,
          },
        ]}
      />
    </PanelPage>
  );
}
