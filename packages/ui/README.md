# @nebula/ui

Sistema de diseño de la plataforma. Es la traducción a React del esqueleto HTML
aprobado por la clienta (`docs/design-reference/index.html`): mismos colores,
tipografías, espaciados y comportamiento.

## Retematizar

Todo el aspecto se controla desde `src/styles/tokens.css`. Cambiar ahí los
valores retematiza tienda y panel a la vez:

```css
--color-primary: #173c2e; /* verde oscuro: barra de anuncios, botones */
--color-accent: #ff5a1f; /* naranja: badge "Oferta", precios, CTAs */
```

## Hojas de estilo

| Archivo                 | Contiene                                             |
| ----------------------- | ---------------------------------------------------- |
| `styles/tokens.css`     | Variables CSS. Única fuente del look & feel          |
| `styles/base.css`       | Reset, contenedor, botones, formularios, avisos      |
| `styles/storefront.css` | Header, hero, grid, drawer, checkout, cuenta, footer |
| `styles/admin.css`      | Sidebar, tablas, KPIs, gráficos del panel            |

Cada app importa las que necesita desde su `globals.css`.

## Componentes

- **Tienda** (`@nebula/ui`): `SiteHeader`, `Hero`, `TrustBar`, `ProductGrid`,
  `ProductCard`, `CartDrawer`, `NewsletterBand`, `SiteFooter`, `Breadcrumbs`,
  `QuantityStepper`, `EmptyState`, iconos y helpers de formato.
- **Panel** (`@nebula/ui/admin`): `AdminShell`, `AdminSidebar`, `DataTable`,
  `StatCard`, `StatusBadge`, `BarChart`, `Timeline`.
- **Carrito**: `CartProvider` + `useCart`. El estado vive en `localStorage`, así
  que sobrevive a recargas sin exigir cuenta.

## Notas

- El paquete se consume sin compilar: las apps lo declaran en
  `transpilePackages`.
- Se usa `<img>` en lugar de `next/image` a propósito: el catálogo sirve desde
  R2 / Supabase Storage con dominios que cambian por entorno, y `next/image`
  exigiría fijarlos en tiempo de build.
- Los componentes no conocen la base de datos. Reciben props planas, para que se
  puedan usar y probar sin Supabase.
