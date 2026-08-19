import Link from 'next/link';
import { money, number } from '@nebula/ui';
import { DataTable, StatusBadge } from '@nebula/ui/admin';
import { PanelPage } from '@/components/panel-page';
import { getSupabaseServerClient } from '@/lib/supabase';
import { PRODUCT_STATUSES, parseEnumParam } from '@/lib/query-params';

export const dynamic = 'force-dynamic';

interface CatalogRow {
  id: string;
  title: string;
  slug: string;
  status: string;
  is_featured: boolean;
  price: number | null;
  sku: string | null;
  stock: number;
}

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; estado?: string }>;
}) {
  const { q, estado } = await searchParams;
  const supabase = await getSupabaseServerClient();

  let query = supabase
    .from('products')
    .select(
      'id, title, slug, status, is_featured, product_variants (price, sku, is_default, inventory (quantity, reserved_quantity))',
    )
    .order('created_at', { ascending: false })
    .limit(100);

  if (q) query = query.ilike('title', `%${q}%`);
  const statusFilter = parseEnumParam(estado, PRODUCT_STATUSES);
  if (statusFilter) query = query.eq('status', statusFilter);

  const { data } = await query;

  const rows: CatalogRow[] = (data ?? []).map((product) => {
    const variant =
      product.product_variants?.find((candidate) => candidate.is_default) ??
      product.product_variants?.[0];
    const inventory = Array.isArray(variant?.inventory) ? variant?.inventory[0] : variant?.inventory;

    return {
      id: product.id,
      title: product.title,
      slug: product.slug,
      status: product.status,
      is_featured: product.is_featured,
      price: variant?.price ?? null,
      sku: variant?.sku ?? null,
      stock: Math.max((inventory?.quantity ?? 0) - (inventory?.reserved_quantity ?? 0), 0),
    };
  });

  return (
    <PanelPage
      title="Productos"
      description="Catálogo completo. Los productos archivados dejan de verse en la tienda pero conservan su histórico de pedidos."
      actions={
        <Link href="/catalogo/nuevo" className="btn btn-dark btn-sm">
          Nuevo producto
        </Link>
      }
    >
      <form className="toolbar" action="/catalogo" method="get">
        <input type="search" name="q" defaultValue={q ?? ''} placeholder="Buscar por título…" />
        <select name="estado" defaultValue={estado ?? ''}>
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
        emptyMessage="Todavía no hay productos. Crea el primero para empezar."
        columns={[
          {
            key: 'title',
            header: 'Producto',
            render: (row) => (
              <div className="cell-product">
                <div className="table-thumb" />
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
            render: (row) => (row.is_featured ? <span className="tag tag-accent">Destacado</span> : '—'),
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
