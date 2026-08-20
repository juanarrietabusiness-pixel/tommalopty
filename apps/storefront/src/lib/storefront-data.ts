import type { MenuItem } from '@nebula/db';
import {
  getBanner,
  getMenu,
  getPublicSettings,
  listProducts,
  type CatalogProduct,
} from '@nebula/db';
import { getSupabaseAnonClient, isSupabaseConfigured } from './supabase';
import { DEMO_ANNOUNCEMENT, DEMO_CTA_BAND, DEMO_HERO, getDemoProducts } from './demo-data';

/**
 * Capa de lectura de la tienda.
 *
 * Hay dos situaciones que parecen la misma y NO lo son:
 *
 *   1. No hay Supabase configurado — entorno de revisión de diseño. Aquí sí se
 *      muestra el contenido de demostración: es lo que se quiere ver.
 *   2. Hay Supabase pero la consulta falló — la base está caída o hay un bug.
 *      Aquí NO se muestra demostración: enseñar productos y precios inventados
 *      a un cliente real es peor que no enseñar nada, porque los añade al
 *      carrito y el checkout los rechaza. Se devuelve vacío y se registra.
 *
 * Confundirlas fue un fallo real detectado en auditoría.
 */

export interface BannerContent {
  eyebrow?: string | null;
  title?: string | null;
  subtitle?: string | null;
  ctaLabel?: string | null;
  ctaHref?: string | null;
  mediaUrl?: string | null;
}

function logQueryError(scope: string, error: unknown): void {
  // Visible en los logs del worker. Si esto aparece en producción, hay
  // incidente: ver docs/RUNBOOK.md.
  console.error(`[storefront] Error consultando ${scope}:`, error);
}

export async function getAnnouncement(): Promise<BannerContent | null> {
  if (!isSupabaseConfigured()) return DEMO_ANNOUNCEMENT;

  try {
    const client = getSupabaseAnonClient();
    const banner = await getBanner(client, 'announcement_bar');
    if (!banner) return null;
    return { eyebrow: banner.eyebrow, title: banner.title, subtitle: banner.subtitle };
  } catch (error) {
    logQueryError('la barra de anuncios', error);
    // Sin barra de anuncios la tienda funciona; con una promoción inventada, no.
    return null;
  }
}

export async function getHero(): Promise<BannerContent> {
  if (!isSupabaseConfigured()) return DEMO_HERO;

  try {
    const client = getSupabaseAnonClient();
    const banner = await getBanner(client, 'hero');
    if (!banner) return DEMO_HERO;
    return {
      eyebrow: banner.eyebrow,
      title: banner.title,
      subtitle: banner.subtitle,
      ctaLabel: banner.cta_label,
      ctaHref: banner.cta_url,
      mediaUrl: banner.media_url,
    };
  } catch (error) {
    logQueryError('el hero', error);
    // El hero sin contenido del CMS cae al texto por defecto del diseño, que no
    // afirma nada falso sobre precios ni promociones.
    return { title: null, ctaLabel: 'Ver ofertas', ctaHref: '/tienda' };
  }
}

export async function getCtaBand(): Promise<BannerContent> {
  if (!isSupabaseConfigured()) return DEMO_CTA_BAND;

  try {
    const client = getSupabaseAnonClient();
    const banner = await getBanner(client, 'cta_band');
    if (!banner) return DEMO_CTA_BAND;
    return { title: banner.title, subtitle: banner.subtitle, ctaLabel: banner.cta_label };
  } catch (error) {
    logQueryError('la banda de newsletter', error);
    return DEMO_CTA_BAND;
  }
}

export interface CatalogResult {
  products: CatalogProduct[];
  /** true = la consulta falló. Permite distinguir "tienda vacía" de "algo se rompió". */
  degraded: boolean;
}

export async function getFeaturedProducts(limit = 10): Promise<CatalogResult> {
  // Sin base de datos configurada: contenido de demostración, a propósito.
  if (!isSupabaseConfigured()) {
    return { products: getDemoProducts().slice(0, limit), degraded: false };
  }

  try {
    const client = getSupabaseAnonClient();
    const { products } = await listProducts(client, { limit });
    return { products, degraded: false };
  } catch (error) {
    // Con base de datos configurada, un fallo NO devuelve productos de
    // demostración: serían precios falsos para un cliente real. Mejor un grid
    // vacío que diga la verdad que una tienda que miente.
    logQueryError('los productos destacados', error);
    return { products: [], degraded: true };
  }
}

const DEFAULT_HEADER_MENU: MenuItem[] = [
  { label: 'Inicio', url: '/' },
  { label: 'Tienda', url: '/tienda' },
  { label: 'Contacto', url: '/p/contacto' },
];

const DEFAULT_FOOTER_SHOP: MenuItem[] = [
  { label: 'Todos los productos', url: '/tienda' },
  { label: 'Ofertas', url: '/tienda?filtro=ofertas' },
  { label: 'Novedades', url: '/tienda?filtro=novedades' },
];

const DEFAULT_FOOTER_HELP: MenuItem[] = [
  { label: 'Contacto', url: '/p/contacto' },
  { label: 'Envíos', url: '/p/envios' },
  { label: 'Cambios y devoluciones', url: '/p/devoluciones' },
];

export async function getNavigation(): Promise<{
  header: MenuItem[];
  footerShop: MenuItem[];
  footerHelp: MenuItem[];
}> {
  const fallback = {
    header: DEFAULT_HEADER_MENU,
    footerShop: DEFAULT_FOOTER_SHOP,
    footerHelp: DEFAULT_FOOTER_HELP,
  };

  if (!isSupabaseConfigured()) return fallback;

  try {
    const client = getSupabaseAnonClient();
    const [header, footerShop, footerHelp] = await Promise.all([
      getMenu(client, 'header'),
      getMenu(client, 'footer_shop'),
      getMenu(client, 'footer_help'),
    ]);

    return {
      header: header.length > 0 ? header : fallback.header,
      footerShop: footerShop.length > 0 ? footerShop : fallback.footerShop,
      footerHelp: footerHelp.length > 0 ? footerHelp : fallback.footerHelp,
    };
  } catch (error) {
    logQueryError('los menús de navegación', error);
    return fallback;
  }
}

export interface BrandSettings {
  name: string;
  tagline: string;
  email: string;
  whatsapp: string;
  freeShippingThreshold: number;
}

const DEFAULT_BRAND: BrandSettings = {
  name: process.env.NEXT_PUBLIC_BRAND_NAME ?? 'Nébula Store',
  tagline: 'Plantilla base de tienda online',
  email: 'hola@tudominio.com',
  whatsapp: '',
  freeShippingThreshold: 50,
};

export async function getBrand(): Promise<BrandSettings> {
  if (!isSupabaseConfigured()) return DEFAULT_BRAND;

  try {
    const client = getSupabaseAnonClient();
    const settings = await getPublicSettings(client);
    const brand = (settings.brand ?? {}) as Partial<BrandSettings>;
    const store = (settings.store ?? {}) as { free_shipping_threshold?: number };

    return {
      name: brand.name ?? DEFAULT_BRAND.name,
      tagline: brand.tagline ?? DEFAULT_BRAND.tagline,
      email: brand.email ?? DEFAULT_BRAND.email,
      whatsapp: brand.whatsapp ?? DEFAULT_BRAND.whatsapp,
      freeShippingThreshold: store.free_shipping_threshold ?? DEFAULT_BRAND.freeShippingThreshold,
    };
  } catch (error) {
    logQueryError('los ajustes de marca', error);
    return DEFAULT_BRAND;
  }
}

/** Convierte los items del CMS al formato que espera @nebula/ui. */
export function toNavItems(items: MenuItem[]): { label: string; href: string }[] {
  return items.map((item) => ({ label: item.label, href: item.url }));
}
