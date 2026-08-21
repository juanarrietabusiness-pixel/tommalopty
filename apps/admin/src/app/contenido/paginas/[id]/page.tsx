import { notFound } from 'next/navigation';
import { PanelPage } from '@/components/panel-page';
import { PageForm, type PageValues } from '@/components/cms-forms';
import { fromBlocks } from '@/lib/cms-blocks';
import { cargarPagina } from '@/lib/panel-data';

export const dynamic = 'force-dynamic';

export default async function EditCmsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const page = await cargarPagina(id);

  if (!page) notFound();

  const initial: PageValues = {
    id: page.id,
    title: page.title,
    slug: page.slug,
    body: fromBlocks(page.content),
    status: page.status,
    seoTitle: page.seo_title ?? '',
    seoDescription: page.seo_description ?? '',
  };

  return (
    <PanelPage title={page.title} description={`Editando /p/${page.slug}`}>
      <div style={{ maxWidth: 760 }}>
        <PageForm initial={initial} />
      </div>
    </PanelPage>
  );
}
