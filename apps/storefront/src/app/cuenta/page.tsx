import type { Metadata } from 'next';
import Link from 'next/link';
import { money, shortDate } from '@nebula/ui';
import { getMyCustomer, listMyOrders } from '@nebula/db';
import { getSupabaseServerClient } from '@/lib/supabase';

export const metadata: Metadata = {
  title: 'Mi cuenta',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const supabase = await getSupabaseServerClient();
  const [customer, orders] = await Promise.all([
    getMyCustomer(supabase),
    listMyOrders(supabase, 3),
  ]);

  return (
    <>
      <h1 className="page-title">Hola{customer?.first_name ? `, ${customer.first_name}` : ''}</h1>
      <p className="page-subtitle">Aquí tienes el resumen de tu actividad.</p>

      <div className="stat-grid" style={{ marginBottom: 32 }}>
        <div className="order-card">
          <span className="field-hint">Pedidos realizados</span>
          <p style={{ fontSize: '1.6rem', fontWeight: 700, margin: '6px 0 0' }}>
            {customer?.orders_count ?? 0}
          </p>
        </div>
        <div className="order-card">
          <span className="field-hint">Total comprado</span>
          <p style={{ fontSize: '1.6rem', fontWeight: 700, margin: '6px 0 0' }}>
            {money(customer?.total_spent ?? 0)}
          </p>
        </div>
      </div>

      <h2 className="page-title" style={{ fontSize: '1.1rem' }}>
        Últimos pedidos
      </h2>

      {orders.length === 0 ? (
        <p className="field-hint">
          Todavía no has hecho ningún pedido. <Link href="/tienda">Explora la tienda</Link>.
        </p>
      ) : (
        orders.map((order) => (
          <div className="order-card" key={order.id}>
            <div className="order-card-head">
              <strong>{order.order_number}</strong>
              <span className="field-hint">{shortDate(order.created_at)}</span>
              <strong>{money(order.total)}</strong>
            </div>
            <span className="field-hint">
              {(order.order_items ?? []).length} artículo(s)
            </span>
          </div>
        ))
      )}
    </>
  );
}
