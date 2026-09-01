import Link from 'next/link';
import { notFound } from 'next/navigation';
import { dateTime, money } from '@nebula/ui';
import { DataTable, StatusBadge, Timeline } from '@nebula/ui/admin';
import { PanelPage } from '@/components/panel-page';
import { OrderNoteForm, OrderStatusForm } from '@/components/order-forms';
import { EnvioForm, NuevoEnvioForm } from '@/components/shipment-forms';
import { AbonosForm, BorrarAbonoButton } from '@/components/abono-forms';
import { cargarEnviosDelPedido, cargarPedido, cargarReglaDeDespacho } from '@/lib/panel-data';

export const dynamic = 'force-dynamic';

interface AddressSnapshot {
  firstName?: string;
  lastName?: string;
  line1?: string;
  line2?: string;
  city?: string;
  province?: string;
  countryCode?: string;
  phone?: string;
}

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const datos = await cargarPedido(id);
  if (!datos) notFound();

  const [{ envios, operadores }, regla] = await Promise.all([
    cargarEnviosDelPedido(id),
    cargarReglaDeDespacho(),
  ]);

  const { order, events, payments: orderPayments } = datos;

  const address = (order.shipping_address ?? {}) as AddressSnapshot;

  return (
    <PanelPage
      title={`Pedido ${order.order_number}`}
      description={`Creado el ${dateTime(order.created_at)}`}
      actions={
        order.customer_id ? (
          <Link href={`/clientes/${order.customer_id}`} className="btn btn-outline btn-sm">
            Ver cliente
          </Link>
        ) : null
      }
    >
      <div className="grid-sidebar">
        <div>
          <section className="card">
            <div className="card-head">
              <h2>Artículos</h2>
              <div style={{ display: 'flex', gap: 8 }}>
                <StatusBadge kind="order" value={order.status} />
                <StatusBadge kind="payment" value={order.payment_status} />
              </div>
            </div>

            <DataTable
              rows={order.order_items ?? []}
              rowKey={(item) => item.id}
              emptyMessage="Este pedido no tiene líneas."
              columns={[
                {
                  key: 'product',
                  header: 'Producto',
                  render: (item) => (
                    <div>
                      <span className="cell-strong">{item.product_title}</span>
                      <div className="cell-muted">
                        {item.variant_title}
                        {item.sku ? ` · ${item.sku}` : ''}
                      </div>
                    </div>
                  ),
                },
                { key: 'qty', header: 'Cant.', align: 'right', render: (item) => item.quantity },
                {
                  key: 'unit',
                  header: 'Precio',
                  align: 'right',
                  render: (item) => money(item.unit_price),
                },
                {
                  key: 'total',
                  header: 'Total',
                  align: 'right',
                  render: (item) => <span className="cell-strong">{money(item.total)}</span>,
                },
              ]}
            />

            <div style={{ marginTop: 20, maxWidth: 320, marginLeft: 'auto' }}>
              <div className="summary-row">
                <span>Subtotal</span>
                <span>{money(order.subtotal)}</span>
              </div>
              {order.discount_total > 0 ? (
                <div className="summary-row">
                  <span>Descuento {order.discount_code ? `(${order.discount_code})` : ''}</span>
                  <span>−{money(order.discount_total)}</span>
                </div>
              ) : null}
              <div className="summary-row">
                <span>Envío</span>
                <span>{money(order.shipping_total)}</span>
              </div>
              <div className="summary-row total">
                <span>Total</span>
                <span>{money(order.total)}</span>
              </div>
            </div>
          </section>

          <section className="card">
            <div className="card-head">
              <h2>Abonos y saldo</h2>
            </div>
            <AbonosForm
              orderId={order.id}
              total={Number(order.total)}
              pagado={Number(order.amount_paid)}
              regla={regla}
            />
          </section>

          <section className="card">
            <div className="card-head">
              <h2>Pagos</h2>
            </div>
            {orderPayments.length === 0 ? (
              <p className="field-hint">
                Sin intentos de pago registrados. Si el pedido se creó antes de conectar la
                pasarela, aparecerá en la bitácora.
              </p>
            ) : (
              <DataTable
                rows={orderPayments}
                rowKey={(payment) => payment.id}
                columns={[
                  { key: 'provider', header: 'Pasarela', render: (payment) => payment.provider },
                  {
                    key: 'ref',
                    header: 'Referencia',
                    render: (payment) => (
                      <span className="cell-muted">
                        {payment.reference ?? payment.provider_payment_id ?? '—'}
                      </span>
                    ),
                  },
                  {
                    key: 'status',
                    header: 'Estado',
                    render: (payment) => <StatusBadge kind="payment" value={payment.status} />,
                  },
                  {
                    key: 'amount',
                    header: 'Importe',
                    align: 'right',
                    render: (payment) => money(payment.amount),
                  },
                  {
                    key: 'borrar',
                    header: '',
                    align: 'right',
                    // Solo los abonos registrados a mano. Un pago de pasarela
                    // no se borra desde aquí: lo que dice la pasarela es la
                    // verdad, y borrarlo dejaría el pedido contando dinero que
                    // el proveedor sí tiene registrado.
                    render: (payment) =>
                      payment.provider === 'manual' ? (
                        <BorrarAbonoButton paymentId={payment.id} orderId={order.id} />
                      ) : null,
                  },
                ]}
              />
            )}
          </section>

          <section className="card">
            <div className="card-head">
              <h2>Bitácora</h2>
            </div>
            <Timeline
              entries={events.map((event) => ({
                id: event.id,
                message: event.message ?? event.type,
                createdAt: event.created_at,
              }))}
            />
            <div style={{ marginTop: 20 }}>
              <OrderNoteForm orderId={order.id} />
            </div>
          </section>

          <section className="card">
            <div className="card-head">
              <h2>Envíos</h2>
              <NuevoEnvioForm orderId={order.id} />
            </div>

            {envios.length === 0 ? (
              <p className="field-hint">
                Todavía no hay ningún envío. Al crearlo se copia la dirección del pedido y se genera
                la guía con su QR.
              </p>
            ) : (
              envios.map((envio) => (
                <div key={envio.id} className="envio">
                  <EnvioForm envio={envio} operadores={operadores} />
                  <Link
                    href={`/pedidos/${order.id}/guia/${envio.id}`}
                    className="btn btn-outline btn-sm"
                    target="_blank"
                  >
                    Ver e imprimir la guía
                  </Link>
                </div>
              ))
            )}
          </section>
        </div>

        <aside>
          <section className="card">
            <div className="card-head">
              <h3>Gestión</h3>
            </div>
            <OrderStatusForm
              orderId={order.id}
              status={order.status}
              paymentStatus={order.payment_status}
              fulfillmentStatus={order.fulfillment_status}
            />
          </section>

          <section className="card">
            <div className="card-head">
              <h3>Cliente</h3>
            </div>
            <p style={{ margin: 0, fontSize: '0.85rem', lineHeight: 1.7 }}>
              <strong>{order.email}</strong>
              {order.phone ? (
                <>
                  <br />
                  {order.phone}
                </>
              ) : null}
            </p>
          </section>

          <section className="card">
            <div className="card-head">
              <h3>Envío</h3>
            </div>
            {address.line1 ? (
              <p style={{ margin: 0, fontSize: '0.85rem', lineHeight: 1.7 }}>
                {address.firstName} {address.lastName}
                <br />
                {address.line1}
                {address.line2 ? `, ${address.line2}` : ''}
                <br />
                {address.city}
                {address.province ? `, ${address.province}` : ''} · {address.countryCode ?? 'PA'}
              </p>
            ) : (
              <p className="field-hint">Sin dirección registrada.</p>
            )}
          </section>

          {order.customer_note ? (
            <section className="card">
              <div className="card-head">
                <h3>Nota del cliente</h3>
              </div>
              <p style={{ margin: 0, fontSize: '0.85rem' }}>{order.customer_note}</p>
            </section>
          ) : null}
        </aside>
      </div>
    </PanelPage>
  );
}
