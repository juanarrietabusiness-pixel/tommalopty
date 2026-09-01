import type { Metadata } from 'next';
import { money, shortDate } from '@nebula/ui';
import { listMyOrders } from '@nebula/db';
import { getSupabaseServerClient, isSupabaseConfigured } from '@/lib/supabase';
import { getDemoPedidos } from '@/lib/demo-data';

export const metadata: Metadata = {
  title: 'Mis pedidos',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  confirmed: 'Confirmado',
  processing: 'En preparación',
  shipped: 'Enviado',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
  refunded: 'Reembolsado',
};

export default async function MyOrdersPage() {
  if (!isSupabaseConfigured()) return <PedidosDemo />;

  const supabase = await getSupabaseServerClient();
  const orders = await listMyOrders(supabase, 50);

  return (
    <>
      <h1 className="page-title">Mis pedidos</h1>
      <p className="page-subtitle">Historial completo y estado de cada envío.</p>

      {orders.length === 0 ? (
        <p className="field-hint">Todavía no tienes pedidos.</p>
      ) : (
        orders.map((order) => (
          <article className="order-card" key={order.id}>
            <div className="order-card-head">
              <strong>{order.order_number}</strong>
              <span className="tag">{STATUS_LABELS[order.status] ?? order.status}</span>
              <span className="field-hint">{shortDate(order.created_at)}</span>
              <strong>{money(order.total)}</strong>
            </div>
            <ul>
              {(order.order_items ?? []).map((item) => (
                <li key={item.id} style={{ fontSize: '0.85rem', padding: '4px 0' }}>
                  {item.product_title} × {item.quantity} — {money(item.total)}
                </li>
              ))}
            </ul>

            {/*
              El saldo solo aparece cuando hay algo que deber. Un aviso de
              «pagado» en cada pedido de la lista es ruido: lo normal es que lo
              estén, y lo que hay que encontrar de un vistazo es el que no.
            */}
            {Number(order.balance_due ?? 0) > 0 ? (
              <p className="order-saldo">
                Llevas abonado {money(Number(order.amount_paid ?? 0))} · quedan{' '}
                <strong>{money(Number(order.balance_due))}</strong> por pagar
              </p>
            ) : null}

            <a className="btn btn-outline btn-sm" href={`/seguimiento/${order.confirmation_token}`}>
              Seguir este pedido
            </a>
          </article>
        ))
      )}
    </>
  );
}

function PedidosDemo() {
  return (
    <>
      <h1 className="page-title">Mis pedidos</h1>
      <p className="page-subtitle">Historial completo y estado de cada envío.</p>

      {getDemoPedidos().map((pedido) => (
        <article className="order-card" key={pedido.numero}>
          <div className="order-card-head">
            <strong>{pedido.numero}</strong>
            <span className="tag">{pedido.estado}</span>
            <span className="field-hint">{shortDate(pedido.fecha)}</span>
            <strong>{money(pedido.total)}</strong>
          </div>
          <ul>
            {pedido.articulos.map((articulo) => (
              <li key={articulo.titulo} style={{ fontSize: '0.85rem', padding: '4px 0' }}>
                {articulo.titulo} × {articulo.cantidad} — {money(articulo.total)}
              </li>
            ))}
          </ul>
        </article>
      ))}
    </>
  );
}
