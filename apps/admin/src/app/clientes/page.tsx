import Link from 'next/link';
import { money, number, shortDate } from '@nebula/ui';
import { DataTable } from '@nebula/ui/admin';
import { listCustomers } from '@nebula/db';
import { PanelPage } from '@/components/panel-page';
import { getSupabaseServerClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; etiqueta?: string }>;
}) {
  const params = await searchParams;
  const supabase = await getSupabaseServerClient();

  const [{ customers, total }, { data: tags }] = await Promise.all([
    listCustomers(supabase, { search: params.q, tag: params.etiqueta, limit: 50 }),
    supabase.from('crm_tags').select('id, name'),
  ]);

  return (
    <PanelPage
      title="Clientes / CRM"
      description={`${total} fichas. Incluye compras de invitado, agrupadas por email.`}
    >
      <form className="toolbar" action="/clientes" method="get">
        <input
          type="search"
          name="q"
          defaultValue={params.q ?? ''}
          placeholder="Buscar por nombre o email…"
        />
        <select name="etiqueta" defaultValue={params.etiqueta ?? ''}>
          <option value="">Todas las etiquetas</option>
          {(tags ?? []).map((tag) => (
            <option key={tag.id} value={tag.name}>
              {tag.name}
            </option>
          ))}
        </select>
        <button type="submit" className="btn btn-outline btn-sm">
          Filtrar
        </button>
      </form>

      <DataTable
        rows={customers}
        rowKey={(customer) => customer.id}
        emptyMessage="Todavía no hay clientes registrados."
        columns={[
          {
            key: 'name',
            header: 'Cliente',
            render: (customer) => (
              <div>
                <Link href={`/clientes/${customer.id}`} className="cell-strong">
                  {[customer.first_name, customer.last_name].filter(Boolean).join(' ') ||
                    customer.email}
                </Link>
                <div className="cell-muted">{customer.email}</div>
              </div>
            ),
          },
          {
            key: 'tags',
            header: 'Etiquetas',
            render: (customer) =>
              customer.tags.length === 0 ? (
                <span className="cell-muted">—</span>
              ) : (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {customer.tags.map((tag) => (
                    <span className="tag" key={tag}>
                      {tag}
                    </span>
                  ))}
                </div>
              ),
          },
          {
            key: 'orders',
            header: 'Pedidos',
            align: 'right',
            render: (customer) => number(customer.orders_count),
          },
          {
            key: 'spent',
            header: 'Total gastado',
            align: 'right',
            render: (customer) => <span className="cell-strong">{money(customer.total_spent)}</span>,
          },
          {
            key: 'last',
            header: 'Última compra',
            render: (customer) => (
              <span className="cell-muted">
                {customer.last_order_at ? shortDate(customer.last_order_at) : '—'}
              </span>
            ),
          },
        ]}
      />
    </PanelPage>
  );
}
