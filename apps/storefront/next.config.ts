import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Los paquetes del monorepo se publican como TypeScript sin compilar.
  transpilePackages: ['@nebula/ui', '@nebula/db', '@nebula/integrations', '@nebula/domain'],

  images: {
    // Añadir aquí el dominio público de R2 / Supabase Storage cuando se defina.
    remotePatterns: [],
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        ],
      },
    ];
  },
};

export default nextConfig;
