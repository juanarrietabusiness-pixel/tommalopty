import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { money, shortDate } from '@nebula/ui';
import { getSupabaseServiceClient, isSupabaseConfigured } from '@/lib/supabase';
import { sendServerEvent } from '@/lib/tracking';

export const metadata: Metadata = {
  title: 'Pedido confirmado',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * Confirmación de pedido.
 *
 * Se autentica con un token opaco, NO con el número de pedido: los números son
 * secuenciales (NB-001000, NB-001001…), así que usarlos como credencial permitía
 * recorrer el histórico completo de la tienda y leer datos de otros compradores.
 * El token va en la URL de retorno de la pasarela y en el email de confirmación.
 */
export default async function OrderConfirmationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  if (!isSupabaseConfigured()) notFound();

  // Un token corto o con formato raro no llega a tocar la base de datos.
  if (!/^[a-f0-9]{48}$/.test(token)) notFound();

  const supabase = getSupabaseServiceClient();
  const { data: order } = await supabase
    .from('orders')
    .select(
      `id, order_number, status, payment_status, currency, subtotal, discount_total,
       shipping_total, total, created_at, email,
       order_items (id, product_title, variant_title, sku, quantity, unit_price, total)`,
    )
    .eq('confirmation_token', token)
    .maybeSingle();

  if (!order) notFound();

  const isPaid = order.payment_status === 'paid';

  // El evento de compra solo se emite cuando el dinero entró, y con un
  // `event_id` derivado del pedido: recargar la página no inventa conversiones
  // nuevas ni rompe la deduplicación de Meta.
  if (isPaid) {
    void sendServerEvent({
      eventName: 'Purchase',
      eventId: `purchase-${order.order_number}`,
      user: { email: order.email },
      customData: {
        currency: order.currency,
        value: order.total,
        orderId: order.order_number,
        contents: (order.order_items ?? []).map((item) => ({
          id: item.sku ?? item.id,
          quantity: item.quantity,
          itemPrice: item.unit_price,
        })),
      },
    });
  }

  return (
    <div className="container section">
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <h1 className="page-title">{isPaid ? '¡Gracias por tu compra!' : 'Pedido registrado'}</h1>
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
          {/*
            El seguimiento va primero y en oscuro: es lo que quien acaba de
            comprar va a querer abrir mañana, y funciona sin haberse registrado
            porque usa este mismo enlace.
          */}
          <Link href={`/seguimiento/${token}`} className="btn btn-dark btn-sm">
            Seguir mi pedido
          </Link>
          <Link href="/tienda" className="btn btn-outline btn-sm">
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
