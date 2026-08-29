import type { NextConfig } from 'next';
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@nebula/ui', '@nebula/db', '@nebula/integrations', '@nebula/domain'],

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // El panel nunca debe embeberse en otro sitio.
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
    ];
  },
};

// Da acceso a los bindings de Cloudflare (el bucket MEDIA) durante `next dev`,
// sirviéndolos con el emulador local de wrangler. Sin esto, subir una imagen
// solo funcionaría una vez desplegado.
void initOpenNextCloudflareForDev();

export default nextConfig;
