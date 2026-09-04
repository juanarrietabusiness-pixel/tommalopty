import { DataTable } from '@nebula/ui/admin';
import { PanelPage } from '@/components/panel-page';
import { CategoryForm } from '@/components/category-form';
import { InterruptorDeFila } from '@/components/interruptor-de-fila';
import { cargarCategorias } from '@/lib/panel-data';
import { toggleCategory } from '@/lib/actions/catalog-extra';

export const dynamic = 'force-dynamic';

export default async function CategoriesPage() {
  const rows = await cargarCategorias();

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
            {
              key: 'name',
              header: 'Categoría',
              render: (row) => <span className="cell-strong">{row.name}</span>,
            },
            {
              key: 'slug',
              header: 'Slug',
              render: (row) => <span className="cell-muted">/{row.slug}</span>,
            },
            {
              key: 'products',
              header: 'Productos',
              align: 'right',
              render: (row) => row.productCount,
            },
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
            {
              key: 'acciones',
              header: '',
              align: 'right',
              render: (row) => (
                <InterruptorDeFila
                  activo={row.isActive}
                  nombre={`la categoría ${row.name}`}
                  alCambiar={toggleCategory.bind(null, row.id)}
                />
              ),
            },
          ]}
        />
        <CategoryForm />
      </div>
    </PanelPage>
  );
}
