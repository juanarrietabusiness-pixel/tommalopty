import Link from 'next/link';
import { shortDate } from '@nebula/ui';
import { DataTable, StatusBadge } from '@nebula/ui/admin';
import { PanelPage } from '@/components/panel-page';
import { PageForm } from '@/components/cms-forms';
import { cargarPaginas } from '@/lib/panel-data';

export const dynamic = 'force-dynamic';

export default async function CmsPagesPage() {
  const pages = await cargarPaginas();

  const storefrontUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

  return (
    <PanelPage
      title="Páginas"
      description="Contenido estático de la tienda: envíos, devoluciones, términos…"
    >
      <div className="grid-sidebar">
        <DataTable
          rows={pages ?? []}
          rowKey={(page) => page.id}
          emptyMessage="Todavía no hay páginas."
          columns={[
            {
              key: 'title',
              header: 'Página',
              render: (page) => (
                <Link href={`/contenido/paginas/${page.id}`} className="cell-strong">
                  {page.title}
                </Link>
              ),
            },
            {
              key: 'slug',
              header: 'URL',
              render: (page) =>
                page.status === 'published' ? (
                  <Link
                    href={`${storefrontUrl}/p/${page.slug}`}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="cell-muted"
                  >
                    /p/{page.slug}
                  </Link>
                ) : (
                  <span className="cell-muted">/p/{page.slug}</span>
                ),
            },
            {
              key: 'status',
              header: 'Estado',
              render: (page) => <StatusBadge kind="content" value={page.status} />,
            },
            {
              key: 'updated',
              header: 'Actualizada',
              render: (page) => <span className="cell-muted">{shortDate(page.updated_at)}</span>,
            },
          ]}
        />
        <PageForm />
      </div>
    </PanelPage>
  );
}
