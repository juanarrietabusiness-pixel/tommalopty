import { DataTable } from '@nebula/ui/admin';
import { PanelPage } from '@/components/panel-page';
import { CategoryForm } from '@/components/category-form';
import { getSupabaseServerClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export default async function CategoriesPage() {
  const supabase = await getSupabaseServerClient();

  const { data: categories } = await supabase
    .from('categories')
    .select('id, name, slug, description, position, is_active, product_categories (product_id)')
    .order('position');

  const rows = (categories ?? []).map((category) => ({
    id: category.id,
    name: category.name,
    slug: category.slug,
    position: category.position,
    isActive: category.is_active,
    productCount: category.product_categories?.length ?? 0,
  }));

  return (
    <PanelPage
      title="Categorías"
      description="Organizan el catálogo y alimentan los filtros de la tienda."
    >
      <div className="grid-sidebar">
        <DataTable
          rows={rows}
          rowKey={(row) => row.id}
          emptyMessage="Todavía no hay categorías."
          columns={[
            { key: 'name', header: 'Categoría', render: (row) => <span className="cell-strong">{row.name}</span> },
            { key: 'slug', header: 'Slug', render: (row) => <span className="cell-muted">/{row.slug}</span> },
            { key: 'products', header: 'Productos', align: 'right', render: (row) => row.productCount },
            { key: 'position', header: 'Orden', align: 'right', render: (row) => row.position },
            {
              key: 'active',
              header: 'Estado',
              render: (row) =>
                row.isActive ? (
                  <span className="tag tag-success">Activa</span>
                ) : (
                  <span className="tag">Oculta</span>
                ),
            },
          ]}
        />
        <CategoryForm />
      </div>
    </PanelPage>
  );
}
