import { expect, test } from '@playwright/test';

/**
 * Comprobaciones de SEO técnico.
 *
 * Un e-commerce vive del tráfico orgánico: si las fichas no son indexables o
 * les faltan metadatos, se paga en publicidad lo que se podría tener gratis.
 */

test.describe('metadatos', () => {
  test('la portada tiene título y descripción', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle(/.+/);
    const descripcion = page.locator('meta[name="description"]');
    await expect(descripcion).toHaveAttribute('content', /.+/);
  });

  test('las páginas privadas no se indexan', async ({ page }) => {
    for (const ruta of ['/carrito', '/checkout', '/entrar']) {
      await page.goto(ruta);
      const robots = await page.locator('meta[name="robots"]').getAttribute('content');
      expect(robots, `${ruta} debería llevar noindex`).toContain('noindex');
    }
  });
});

test.describe('archivos de rastreo', () => {
  test('robots.txt existe y apunta al sitemap', async ({ request, baseURL }) => {
    const response = await request.get('/robots.txt');
    expect(response.status()).toBe(200);

    const body = await response.text();
    expect(body).toContain('Sitemap:');
    // Las rutas con datos del visitante no deben rastrearse.
    expect(body).toContain('/checkout');
    expect(baseURL).toBeTruthy();
  });

  test('sitemap.xml es XML válido con URLs', async ({ request }) => {
    const response = await request.get('/sitemap.xml');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('xml');

    const body = await response.text();
    expect(body).toContain('<urlset');
    expect(body).toContain('<loc>');
  });
});

test.describe('rendimiento percibido', () => {
  test('la portada pinta contenido rápido', async ({ page }) => {
    await page.goto('/');

    // First Contentful Paint: umbral holgado porque en CI la máquina es lenta;
    // sirve para detectar una regresión grave, no para medir con precisión.
    const fcp = await page.evaluate(() => {
      const entry = performance.getEntriesByName('first-contentful-paint')[0];
      return entry ? entry.startTime : 0;
    });

    expect(fcp).toBeLessThan(3000);
  });

  test('no hay errores de consola en la portada', async ({ page }) => {
    const errores: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errores.push(msg.text());
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    expect(errores).toEqual([]);
  });
});
