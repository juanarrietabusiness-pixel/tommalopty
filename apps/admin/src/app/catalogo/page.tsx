import Link from 'next/link';
import { money, number } from '@nebula/ui';
import { DataTable, StatusBadge } from '@nebula/ui/admin';
import { PanelPage } from '@/components/panel-page';
import { cargarCatalogo, type FilaCatalogo } from '@/lib/panel-data';
import { PRODUCT_STATUSES, mensajeVacio, parseEnumParam } from '@/lib/query-params';

export const dynamic = 'force-dynamic';

type CatalogRow = FilaCatalogo;

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; estado?: string }>;
}) {
  const { q, estado } = await searchParams;

  const hayFiltros = Boolean(q || estado);

  const rows: CatalogRow[] = await cargarCatalogo({
    search: q,
    status: parseEnumParam(estado, PRODUCT_STATUSES),
  });

  return (
    <PanelPage
      title="Productos"
      description="Catálogo completo. Los productos archivados dejan de verse en la tienda pero conservan su histórico de pedidos."
      actions={
        <>
          <Link href="/catalogo/importar" className="btn btn-outline btn-sm">
            Importar
          </Link>
          <Link href="/catalogo/nuevo" className="btn btn-dark btn-sm">
            Nuevo producto
          </Link>
        </>
      }
    >
      <form className="toolbar" action="/catalogo" method="get">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ''}
          placeholder="Buscar por título…"
          aria-label="Buscar productos por título"
        />
        <select
          name="estado"
          aria-label="Filtrar por estado del producto"
          defaultValue={estado ?? ''}
        >
          <option value="">Todos los estados</option>
          <option value="active">Activos</option>
          <option value="draft">Borradores</option>
          <option value="archived">Archivados</option>
        </select>
        <button type="submit" className="btn btn-outline btn-sm">
          Filtrar
        </button>
      </form>

      <DataTable
        rows={rows}
        rowKey={(row) => row.id}
        emptyMessage={mensajeVacio(
          hayFiltros,
          'Todavía no hay productos. Crea el primero para empezar.',
        )}
        columns={[
          {
            key: 'title',
            header: 'Producto',
            render: (row) => (
              <div className="cell-product">
                <div className="table-thumb">
                  {/* Un `<img>` y no `next/image`: la URL viene de R2 o, en el
                      recorrido de demostración, de un data URI, y ninguno de los
                      dos gana nada pasando por el optimizador. */}
                  {row.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={row.imageUrl} alt={row.imageAlt ?? ''} loading="lazy" />
                  ) : null}
                </div>
                <div>
                  <Link href={`/catalogo/${row.id}`} className="cell-strong">
                    {row.title}
                  </Link>
                  <div className="cell-muted">/{row.slug}</div>
                </div>
              </div>
            ),
          },
          { key: 'sku', header: 'SKU', render: (row) => row.sku ?? '—' },
          {
            key: 'status',
            header: 'Estado',
            render: (row) => <StatusBadge kind="content" value={row.status} />,
          },
          {
            key: 'featured',
            header: 'Portada',
            render: (row) =>
              row.is_featured ? <span className="tag tag-accent">Destacado</span> : '—',
          },
          {
            key: 'stock',
            header: 'Stock',
            align: 'right',
            render: (row) => number(row.stock),
          },
          {
            key: 'price',
            header: 'Precio',
            align: 'right',
            render: (row) => (row.price === null ? '—' : money(row.price)),
          },
        ]}
      />
    </PanelPage>
  );
}
