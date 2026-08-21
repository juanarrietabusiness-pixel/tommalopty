import type { Metadata } from 'next';
import Link from 'next/link';
import { money, shortDate } from '@nebula/ui';
import { getMyCustomer, listMyOrders } from '@nebula/db';
import { getSupabaseServerClient, isSupabaseConfigured } from '@/lib/supabase';
import { DEMO_CLIENTE, getDemoPedidos } from '@/lib/demo-data';

export const metadata: Metadata = {
  title: 'Mi cuenta',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  if (!isSupabaseConfigured()) return <ResumenDemo />;

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
            <span className="field-hint">{(order.order_items ?? []).length} artículo(s)</span>
          </div>
        ))
      )}
    </>
  );
}

function ResumenDemo() {
  const pedidos = getDemoPedidos().slice(0, 3);

  return (
    <>
      <h1 className="page-title">Hola, {DEMO_CLIENTE.nombre}</h1>
      <p className="page-subtitle">Aquí tienes el resumen de tu actividad.</p>

      <div className="stat-grid" style={{ marginBottom: 32 }}>
        <div className="order-card">
          <span className="field-hint">Pedidos realizados</span>
          <p style={{ fontSize: '1.6rem', fontWeight: 700, margin: '6px 0 0' }}>
            {DEMO_CLIENTE.pedidos}
          </p>
        </div>
        <div className="order-card">
          <span className="field-hint">Total comprado</span>
          <p style={{ fontSize: '1.6rem', fontWeight: 700, margin: '6px 0 0' }}>
            {money(DEMO_CLIENTE.totalGastado)}
          </p>
        </div>
      </div>

      <h2 className="page-title" style={{ fontSize: '1.1rem' }}>
        Últimos pedidos
      </h2>

      {pedidos.map((pedido) => (
        <div className="order-card" key={pedido.numero}>
          <div className="order-card-head">
            <strong>{pedido.numero}</strong>
            <span className="field-hint">{shortDate(pedido.fecha)}</span>
            <strong>{money(pedido.total)}</strong>
          </div>
          <span className="field-hint">
            {pedido.articulos.length} artículo(s) · {pedido.estado}
          </span>
        </div>
      ))}

      <p className="field-hint" style={{ marginTop: 24 }}>
        ¿Buscas algo más? <Link href="/tienda">Explora la tienda</Link>.
      </p>
    </>
  );
}
