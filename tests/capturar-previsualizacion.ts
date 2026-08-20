import { chromium, devices } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';

/**
 * Genera capturas de la tienda en los tres tamaños que importan, para revisión
 * de diseño sin necesidad de levantar nada.
 *
 *   pnpm --filter @nebula/tests exec tsx capturar-previsualizacion.ts
 */
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:4321';
const OUT = join(dirname(new URL(import.meta.url).pathname), '..', 'docs', 'previsualizacion');

const TAMANOS = [
  { nombre: 'escritorio', viewport: { width: 1440, height: 900 }, mobile: false },
  { nombre: 'tablet', viewport: { width: 834, height: 1112 }, mobile: false },
  { nombre: 'movil', ...devices['Pixel 7'] },
] as const;

const PAGINAS = [
  { nombre: 'portada', ruta: '/', completa: true },
  { nombre: 'catalogo', ruta: '/tienda', completa: false },
  { nombre: 'carrito', ruta: '/carrito', completa: false },
  { nombre: 'checkout', ruta: '/checkout', completa: false },
] as const;

async function main() {
  await mkdir(OUT, { recursive: true });

  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
  });

  for (const tamano of TAMANOS) {
    const context = await browser.newContext({
      ...tamano,
      locale: 'es-PA',
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();

    for (const pagina of PAGINAS) {
      // El carrito y el checkout solo tienen sentido con algo dentro.
      if (pagina.ruta === '/carrito' || pagina.ruta === '/checkout') {
        await page.goto(`${BASE_URL}/`);
        await page
          .locator('.product-card')
          .first()
          .getByRole('button', { name: /añadir/i })
          .click();
        await page.getByRole('button', { name: /cerrar carrito/i }).click();
      }

      await page.goto(`${BASE_URL}${pagina.ruta}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(400);

      const archivo = join(OUT, `${pagina.nombre}-${tamano.nombre}.png`);
      await page.screenshot({ path: archivo, fullPage: pagina.completa });
      console.log(`✓ ${pagina.nombre} · ${tamano.nombre}`);
    }

    // El drawer del carrito abierto: es el momento de la compra por impulso.
    if (tamano.nombre === 'escritorio') {
      await page.goto(`${BASE_URL}/`);
      await page
        .locator('.product-card')
        .first()
        .getByRole('button', { name: /añadir/i })
        .click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: join(OUT, 'carrito-drawer-escritorio.png') });
      console.log('✓ drawer de carrito · escritorio');
    }

    await context.close();
  }

  await browser.close();
  console.log(`\nCapturas en ${OUT}`);
}

void main();
