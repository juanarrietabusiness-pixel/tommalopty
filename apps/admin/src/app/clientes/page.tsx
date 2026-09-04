import Link from 'next/link';
import { money, number, shortDate } from '@nebula/ui';
import { redirect } from 'next/navigation';
import { DataTable, Paginacion } from '@nebula/ui/admin';
import { PanelPage } from '@/components/panel-page';
import { cargarClientes } from '@/lib/panel-data';
import { POR_PAGINA, paginar, parsePagina } from '@/lib/query-params';

export const dynamic = 'force-dynamic';

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; etiqueta?: string; pagina?: string }>;
}) {
  const params = await searchParams;
  const pedida = parsePagina(params.pagina);

  const { customers, total, tags } = await cargarClientes({
    search: params.q,
    tag: params.etiqueta,
    limit: POR_PAGINA,
    offset: (pedida - 1) * POR_PAGINA,
  });

  const pagina = paginar(total, pedida, POR_PAGINA);

  // Igual que en pedidos: una página que no existe se corrige en la dirección,
  // no se enseña como una tabla vacía debajo del total completo.
  if (pagina.pagina !== pedida) redirect(hrefDePagina(params, pagina.pagina));

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
          aria-label="Buscar clientes por nombre o email"
        />
        <select
          name="etiqueta"
          aria-label="Filtrar por etiqueta"
          defaultValue={params.etiqueta ?? ''}
        >
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
            render: (customer) => (
              <span className="cell-strong">{money(customer.total_spent)}</span>
            ),
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

      <Paginacion
        pagina={pagina.pagina}
        totalPaginas={pagina.totalPaginas}
        desde={pagina.desde}
        hasta={pagina.hasta}
        total={total}
        nombre="fichas"
        hrefDePagina={(n) => hrefDePagina(params, n)}
      />
    </PanelPage>
  );
}

/** La misma dirección con otra página, conservando los filtros puestos. */
function hrefDePagina(params: { q?: string; etiqueta?: string }, pagina: number): string {
  const busqueda = new URLSearchParams();
  if (params.q) busqueda.set('q', params.q);
  if (params.etiqueta) busqueda.set('etiqueta', params.etiqueta);
  if (pagina > 1) busqueda.set('pagina', String(pagina));

  const cola = busqueda.toString();
  return cola ? `/clientes?${cola}` : '/clientes';
}
