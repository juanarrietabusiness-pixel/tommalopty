import type { MetadataRoute } from 'next';
import { listPublishedPageSlugs, listPublishedProductSlugs } from '@nebula/db';
import { getSupabaseAnonClient, isSupabaseConfigured } from '@/lib/supabase';
import { siteUrl } from '@/lib/site';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/tienda`, changeFrequency: 'daily', priority: 0.9 },
  ];

  if (!isSupabaseConfigured()) return staticRoutes;

  try {
    const client = getSupabaseAnonClient();
    const [products, pages] = await Promise.all([
      listPublishedProductSlugs(client),
      listPublishedPageSlugs(client),
    ]);

    return [
      ...staticRoutes,
      ...products.map((product) => ({
        url: `${base}/producto/${product.slug}`,
        lastModified: new Date(product.updated_at),
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      })),
      ...pages.map((page) => ({
        url: `${base}/p/${page.slug}`,
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
