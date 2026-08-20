import type { Metadata } from 'next';
import { money, shortDate } from '@nebula/ui';
import { listMyOrders } from '@nebula/db';
import { getSupabaseServerClient } from '@/lib/supabase';

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
          </article>
        ))
      )}
    </>
  );
}
