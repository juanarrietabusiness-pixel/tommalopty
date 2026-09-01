/** Punto de entrada del sistema de diseño de la tienda pública. */
export { CartProvider, useCart, type CartLine } from './cart/cart-context';

export { AnnouncementBar, type AnnouncementBarProps } from './components/announcement-bar';
export { Hero, type HeroProps } from './components/hero';
export { TrustBar, DEFAULT_TRUST_ITEMS, type TrustItem } from './components/trust-bar';
export { SectionHead, type SectionHeadProps } from './components/section-head';
export { ProductCard, type ProductCardData } from './components/product-card';
export { ProductGrid, type ProductGridProps } from './components/product-grid';
export { CartDrawer } from './components/cart-drawer';
export { MobileNav, type MobileNavProps } from './components/mobile-nav';
export { SiteHeader, type NavItem, type SiteHeaderProps } from './components/site-header';
export { NewsletterBand, type NewsletterBandProps } from './components/newsletter-band';
export { SiteFooter, type FooterColumn, type SiteFooterProps } from './components/site-footer';
export { Breadcrumbs, type Crumb } from './components/breadcrumbs';
export { EmptyState } from './components/empty-state';
export { QuantityStepper, type QuantityStepperProps } from './components/quantity-stepper';

export * from './components/icons';
export { estiloDelMapa, TILES_URL, ATTRIBUTION, type EstiloRaster } from './lib/mapa';
export {
  money,
  number,
  percent,
  shortDate,
  dateTime,
  slugify,
  discountPercent,
} from './lib/format';
