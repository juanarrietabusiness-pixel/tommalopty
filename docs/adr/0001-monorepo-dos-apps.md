# 0001 · Monorepo con dos aplicaciones separadas

**Estado:** aceptada · agosto 2026

## Contexto

La plataforma necesita tienda pública y panel administrativo. Podrían ser rutas
de una misma aplicación Next.js, dos aplicaciones en un monorepo, o dos
repositorios independientes.

## Decisión

Un monorepo (Turborepo + pnpm) con `apps/storefront` y `apps/admin` como
aplicaciones separadas, y lo compartido en `packages/`.

## Por qué

**Perfiles de caché opuestos.** La tienda vive de contenido estático e ISR; el
panel es totalmente dinámico. En una sola app, la configuración de una estorba a
la otra.

**Superficie pública distinta.** El panel no debe indexarse, va en su propio
dominio y puede protegerse con Cloudflare Access antes de llegar a la pantalla de
acceso. Con rutas compartidas, un error de configuración expone el panel.

**Trabajo en paralelo.** Varios programadores tocando tienda y panel a la vez sin
pisarse.

Un monorepo y no dos repositorios porque el diseño (`packages/ui`), el acceso a
datos (`packages/db`) y las reglas de negocio (`packages/domain`) son comunes:
en repos separados se duplican y divergen.

## Lo que se acepta a cambio

Más ceremonia inicial y builds algo más lentos. Un cambio en `packages/ui`
obliga a rebuildear ambas apps; la caché de Turborepo lo amortigua.
