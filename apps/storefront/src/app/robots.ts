import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Rutas sin valor de indexación y con datos del visitante.
        disallow: ['/checkout', '/carrito', '/cuenta', '/api/', '/buscar'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
