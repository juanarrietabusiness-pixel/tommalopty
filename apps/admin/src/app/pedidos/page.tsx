import Link from 'next/link';
import { money, shortDate } from '@nebula/ui';
import { redirect } from 'next/navigation';
import { DataTable, Paginacion, StatusBadge } from '@nebula/ui/admin';
import { PanelPage } from '@/components/panel-page';
import {
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  POR_PAGINA,
  paginar,
  parseEnumParam,
  parsePagina,
  mensajeVacio,
} from '@/lib/query-params';
import { cargarPedidos } from '@/lib/panel-data';

export const dynamic = 'force-dynamic';

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; estado?: string; pago?: string; pagina?: string }>;
}) {
  const params = await searchParams;
  const pedida = parsePagina(params.pagina);

  const { orders, total } = await cargarPedidos({
    search: params.q,
    status: parseEnumParam(params.estado, ORDER_STATUSES),
    paymentStatus: parseEnumParam(params.pago, PAYMENT_STATUSES),
    limit: POR_PAGINA,
    offset: (pedida - 1) * POR_PAGINA,
  });

  const pagina = paginar(total, pedida, POR_PAGINA);
  const hayFiltros = Boolean(params.q || params.estado || params.pago);

  // Pedir una página que no existe —un enlace viejo, un filtro que redujo la
  // lista— devolvería una tabla vacía con «1.240 pedidos» en la cabecera, que
  // es justo la contradicción que esto venía a quitar. Se corrige la dirección
  // en vez de enseñar el hueco.
  if (pagina.pagina !== pedida) redirect(hrefDePagina(params, pagina.pagina));

  return (
    <PanelPage title="Pedidos" description={`${total} pedidos registrados.`}>
      <form className="toolbar" action="/pedidos" method="get">
        <input
          type="search"
          name="q"
          defaultValue={params.q ?? ''}
          placeholder="Buscar por número o email…"
          aria-label="Buscar pedidos por número o email"
        />
        <select
          name="estado"
          aria-label="Filtrar por estado del pedido"
          defaultValue={params.estado ?? ''}
        >
          <option value="">Todos los estados</option>
          <option value="pending">Pendiente</option>
          <option value="confirmed">Confirmado</option>
          <option value="processing">En preparación</option>
          <option value="shipped">Enviado</option>
          <option value="delivered">Entregado</option>
          <option value="cancelled">Cancelado</option>
        </select>
        <select
          name="pago"
          aria-label="Filtrar por estado del pago"
          defaultValue={params.pago ?? ''}
        >
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
        emptyMessage={mensajeVacio(hayFiltros, 'Todavía no hay pedidos.')}
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

      <Paginacion
        pagina={pagina.pagina}
        totalPaginas={pagina.totalPaginas}
        desde={pagina.desde}
        hasta={pagina.hasta}
        total={total}
        nombre="pedidos"
        hrefDePagina={(n) => hrefDePagina(params, n)}
      />
    </PanelPage>
  );
}

/** La misma dirección con otra página, conservando los filtros puestos. */
function hrefDePagina(
  params: { q?: string; estado?: string; pago?: string },
  pagina: number,
): string {
  const busqueda = new URLSearchParams();
  if (params.q) busqueda.set('q', params.q);
  if (params.estado) busqueda.set('estado', params.estado);
  if (params.pago) busqueda.set('pago', params.pago);
  if (pagina > 1) busqueda.set('pagina', String(pagina));

  const cola = busqueda.toString();
  return cola ? `/pedidos?${cola}` : '/pedidos';
}
