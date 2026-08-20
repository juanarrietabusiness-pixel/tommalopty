import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Rutas sin valor de indexación y con datos del visitante.
        disallow: ['/checkout', '/carrito', '/cuenta', '/api/', '/buscar'],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
