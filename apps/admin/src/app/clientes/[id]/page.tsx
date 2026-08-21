import Link from 'next/link';
import { notFound } from 'next/navigation';
import { dateTime, money, number, shortDate } from '@nebula/ui';
import { DataTable, StatCard, StatGrid, StatusBadge, Timeline } from '@nebula/ui/admin';
import { PanelPage } from '@/components/panel-page';
import { CustomerNoteForm, CustomerTagsForm } from '@/components/crm-forms';
import { cargarCliente } from '@/lib/panel-data';

export const dynamic = 'force-dynamic';

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const datos = await cargarCliente(id);
  if (!datos) notFound();

  const { customer, orders, notes } = datos;

  const fullName =
    [customer.first_name, customer.last_name].filter(Boolean).join(' ') || customer.email;

  return (
    <PanelPage title={fullName} description={`Cliente desde ${shortDate(customer.created_at)}`}>
      <StatGrid>
        <StatCard label="Pedidos" value={number(customer.orders_count)} />
        <StatCard label="Total gastado" value={money(customer.total_spent)} />
        <StatCard
          label="Última compra"
          value={customer.last_order_at ? shortDate(customer.last_order_at) : '—'}
        />
        <StatCard
          label="Marketing"
          value={customer.accepts_marketing ? 'Suscrito' : 'No suscrito'}
        />
      </StatGrid>

      <div className="grid-sidebar">
        <div>
          <section className="card">
            <div className="card-head">
              <h2>Historial de pedidos</h2>
            </div>
            <DataTable
              rows={orders}
              rowKey={(order) => order.id}
              emptyMessage="Este cliente todavía no ha comprado."
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
                  render: (order) => (
                    <span className="cell-muted">{shortDate(order.created_at)}</span>
                  ),
                },
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
          </section>

          <section className="card">
            <div className="card-head">
              <h2>Notas internas</h2>
            </div>
            <Timeline
              entries={notes.map((note) => ({
                id: note.id,
                message: `${note.is_pinned ? '📌 ' : ''}${note.body}`,
                createdAt: note.created_at,
              }))}
            />
            <div style={{ marginTop: 20 }}>
              <CustomerNoteForm customerId={customer.id} />
            </div>
          </section>
        </div>

        <aside>
          <section className="card">
            <div className="card-head">
              <h3>Contacto</h3>
            </div>
            <p style={{ margin: 0, fontSize: '0.85rem', lineHeight: 1.7 }}>
              <strong>{customer.email}</strong>
              {customer.phone ? (
                <>
                  <br />
                  {customer.phone}
                </>
              ) : null}
            </p>
            <p className="field-hint" style={{ marginTop: 10 }}>
              {customer.profile_id
                ? 'Tiene cuenta en la tienda.'
                : 'Compra como invitado (sin cuenta).'}
            </p>
          </section>

          <section className="card">
            <div className="card-head">
              <h3>Segmentación</h3>
            </div>
            <CustomerTagsForm customerId={customer.id} tags={customer.tags} />
          </section>

          <section className="card">
            <div className="card-head">
              <h3>Actividad</h3>
            </div>
            <p className="field-hint">Ficha actualizada {dateTime(customer.updated_at)}</p>
          </section>
        </aside>
      </div>
    </PanelPage>
  );
}
