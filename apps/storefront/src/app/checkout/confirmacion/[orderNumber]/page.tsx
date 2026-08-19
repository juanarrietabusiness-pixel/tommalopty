import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { money, shortDate } from '@nebula/ui';
import { getSupabaseServiceClient, isSupabaseConfigured } from '@/lib/supabase';
import { createEventId, sendServerEvent } from '@/lib/tracking';

export const metadata: Metadata = {
  title: 'Pedido confirmado',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function OrderConfirmationPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = await params;

  if (!isSupabaseConfigured()) notFound();

  // Lectura con service-role: la confirmación debe funcionar también para
  // compras de invitado, que no tienen sesión.
  const supabase = getSupabaseServiceClient();
  const { data: order } = await supabase
    .from('orders')
    .select('*, order_items (*)')
    .eq('order_number', orderNumber)
    .maybeSingle();

  if (!order) notFound();

  // Evento de compra en servidor (Conversions API). Se emite aquí porque es el
  // punto en el que el pedido existe con certeza.
  await sendServerEvent({
    eventName: 'Purchase',
    eventId: createEventId(`purchase-${order.order_number}`),
    user: { email: order.email },
    customData: {
      currency: order.currency,
      value: order.total,
      orderId: order.order_number,
      contents: (order.order_items ?? []).map((item) => ({
        id: item.sku ?? item.variant_id ?? item.id,
        quantity: item.quantity,
        itemPrice: item.unit_price,
      })),
    },
  });

  const isPaid = order.payment_status === 'paid';

  return (
    <div className="container section">
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <h1 className="page-title">
          {isPaid ? '¡Gracias por tu compra!' : 'Pedido registrado'}
        </h1>
        <p className="page-subtitle">
          Pedido <strong>{order.order_number}</strong> · {shortDate(order.created_at)}
        </p>

        {!isPaid ? (
          <div className="notice notice-info">
            Tu pedido quedó registrado y está pendiente de confirmación de pago. Te avisaremos por
            correo en cuanto se complete.
          </div>
        ) : null}

        <div className="summary-card" style={{ position: 'static' }}>
          <h2>Resumen</h2>
          {(order.order_items ?? []).map((item) => (
            <div className="summary-row" key={item.id}>
              <span>
                {item.product_title} × {item.quantity}
              </span>
              <span>{money(item.total)}</span>
            </div>
          ))}
          <div className="summary-row">
            <span>Subtotal</span>
            <span>{money(order.subtotal)}</span>
          </div>
          {order.discount_total > 0 ? (
            <div className="summary-row">
              <span>Descuento</span>
              <span>−{money(order.discount_total)}</span>
            </div>
          ) : null}
          <div className="summary-row">
            <span>Envío</span>
            <span>{order.shipping_total === 0 ? 'Gratis' : money(order.shipping_total)}</span>
          </div>
          <div className="summary-row total">
            <span>Total</span>
            <span>{money(order.total)}</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 28, flexWrap: 'wrap' }}>
          <Link href="/tienda" className="btn btn-dark btn-sm">
            Seguir comprando
          </Link>
          <Link href="/cuenta/pedidos" className="btn btn-outline btn-sm">
            Ver mis pedidos
          </Link>
        </div>
      </div>
    </div>
  );
}
