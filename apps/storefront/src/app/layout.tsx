import type { Metadata } from 'next';
import { Inter, Poppins } from 'next/font/google';
import { CartProvider, SiteFooter, SiteHeader } from '@nebula/ui';
import { MetaPixel } from '@/components/meta-pixel';
import { siteUrl } from '@/lib/site';
import { getAnnouncement, getBrand, getNavigation, toNavItems } from '@/lib/storefront-data';
import './globals.css';

// Las mismas familias del esqueleto, servidas por Next para evitar el salto de
// fuente y la petición extra a Google Fonts.
const poppins = Poppins({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-poppins',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter',
  display: 'swap',
});

export async function generateMetadata(): Promise<Metadata> {
  const brand = await getBrand();

  return {
    metadataBase: new URL(siteUrl()),
    title: {
      default: `${brand.name} — Tienda online`,
      template: `%s · ${brand.name}`,
    },
    description: brand.tagline,
    openGraph: {
      type: 'website',
      siteName: brand.name,
      locale: 'es_PA',
    },
    robots: { index: true, follow: true },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [brand, navigation, announcement] = await Promise.all([
    getBrand(),
    getNavigation(),
    getAnnouncement(),
  ]);

  return (
    <html lang="es" className={`${poppins.variable} ${inter.variable}`}>
      <body>
        <CartProvider>
          <SiteHeader
            brandName={brand.name}
            navItems={toNavItems(navigation.header)}
            announcement={announcement}
          />
          <main>{children}</main>
          <SiteFooter
            brandName={brand.name}
            description={brand.tagline}
            columns={[
              { title: 'Tienda', items: toNavItems(navigation.footerShop) },
              { title: 'Ayuda', items: toNavItems(navigation.footerHelp) },
              {
                title: 'Contacto',
                items: [
                  ...(brand.whatsapp
                    ? [{ label: '¡Escríbenos por WhatsApp!', href: brand.whatsapp }]
                    : []),
                  { label: brand.email, href: `mailto:${brand.email}` },
                ],
              },
            ]}
          />
        </CartProvider>
        <MetaPixel />
      </body>
    </html>
  );
}
