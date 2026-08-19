# Referencia de diseño

`index.html` es el esqueleto estático original aprobado por la clienta. **No es
código de producción y no se despliega**: se conserva como referencia visual.

Todo su lenguaje visual está migrado a `packages/ui`:

| Bloque del esqueleto | Dónde vive ahora |
| --- | --- |
| Tokens `:root` | `packages/ui/src/styles/tokens.css` |
| Header y barra de anuncios | `SiteHeader`, `AnnouncementBar` |
| Hero | `Hero` (contenido editable desde el CMS) |
| Barra de confianza | `TrustBar` |
| Grid de productos | `ProductGrid`, `ProductCard` |
| Drawer de carrito | `CartDrawer` + `CartProvider` |
| Banda de newsletter | `NewsletterBand` |
| Footer | `SiteFooter` |
| Menú móvil | `MobileNav` |

Si hay que ajustar el diseño, se cambia en `packages/ui` — no aquí. Este archivo
solo sirve para comparar contra el original.
