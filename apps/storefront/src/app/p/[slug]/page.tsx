import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@nebula/ui';
import { getPage, listPublishedPageSlugs, type Json } from '@nebula/db';
import { getSupabaseAnonClient, isSupabaseConfigured } from '@/lib/supabase';
import { getDemoPageBySlug, getDemoPageSlugs } from '@/lib/demo-data';

export const revalidate = 900;
export const dynamicParams = true;

export async function generateStaticParams() {
  // Sin base de datos se prerenderizan las de demostración, que son justo las
  // que enlaza el pie: devolver [] dejaba las cinco sin generar.
  if (!isSupabaseConfigured()) return getDemoPageSlugs().map((slug) => ({ slug }));
  try {
    const client = getSupabaseAnonClient();
    const pages = await listPublishedPageSlugs(client);
    return pages.map((page) => ({ slug: page.slug }));
  } catch {
    return [];
  }
}

async function loadPage(slug: string) {
  // Mismo caso que la ficha de producto: sin Supabase esto devolvía null y la
  // página llamaba a notFound(), así que términos, privacidad, devoluciones,
  // envíos y contacto —los cinco enlaces del pie, y dos de ellos enlazados
  // también desde el checkout— daban 404 en la única modalidad en la que hoy
  // se puede enseñar la tienda.
  if (!isSupabaseConfigured()) return getDemoPageBySlug(slug);

  const client = getSupabaseAnonClient();
  return getPage(client, slug);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = await loadPage(slug);
  if (!page) return { title: 'Página no encontrada' };

  return {
    title: page.seo_title ?? page.title,
    description: page.seo_description ?? undefined,
    alternates: { canonical: `/p/${page.slug}` },
  };
}

/**
 * Renderiza los bloques del CMS.
 * Por ahora solo `richtext`; añadir tipos nuevos es cuestión de extender este
 * switch y el editor del panel.
 */
function renderBlock(block: Json, index: number) {
  if (typeof block !== 'object' || block === null || Array.isArray(block)) return null;

  const type = 'type' in block ? String(block.type) : '';
  const value = 'value' in block ? String(block.value) : '';

  switch (type) {
    case 'heading':
      return <h2 key={index}>{value}</h2>;
    case 'richtext':
    default:
      return <p key={index}>{value}</p>;
  }
}

export default async function CmsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await loadPage(slug);

  if (!page) notFound();

  const blocks = Array.isArray(page.content) ? page.content : [];

  return (
    <div className="container">
      <Breadcrumbs items={[{ label: 'Inicio', href: '/' }, { label: page.title }]} />
      <article className="section">
        <h1 className="page-title">{page.title}</h1>
        <div className="prose">{blocks.map(renderBlock)}</div>
      </article>
    </div>
  );
}
