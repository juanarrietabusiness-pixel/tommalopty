import type { MetadataRoute } from 'next';
import { listPublishedPageSlugs, listPublishedProductSlugs } from '@nebula/db';
import { getSupabaseServerClient, isSupabaseConfigured } from '@/lib/supabase';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: siteUrl, changeFrequency: 'daily', priority: 1 },
    { url: `${siteUrl}/tienda`, changeFrequency: 'daily', priority: 0.9 },
  ];

  if (!isSupabaseConfigured()) return staticRoutes;

  try {
    const client = await getSupabaseServerClient();
    const [products, pages] = await Promise.all([
      listPublishedProductSlugs(client),
      listPublishedPageSlugs(client),
    ]);

    return [
      ...staticRoutes,
      ...products.map((product) => ({
        url: `${siteUrl}/producto/${product.slug}`,
        lastModified: new Date(product.updated_at),
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      })),
      ...pages.map((page) => ({
        url: `${siteUrl}/p/${page.slug}`,
        lastModified: new Date(page.updated_at),
        changeFrequency: 'monthly' as const,
        priority: 0.5,
      })),
    ];
  } catch (error) {
    console.error('[sitemap] No se pudo leer el catálogo:', error);
    return staticRoutes;
  }
}
