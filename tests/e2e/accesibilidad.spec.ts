import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/**
 * Auditoría de accesibilidad con axe.
 *
 * No es un requisito legal opcional: una tienda que no se puede usar con
 * teclado o lector de pantalla pierde clientes reales, y el mismo trabajo
 * mejora el SEO. Se auditan las páginas del embudo de compra, que son las que
 * cuestan dinero si fallan.
 */

const NIVELES = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function auditar(page: import('@playwright/test').Page) {
  return new AxeBuilder({ page }).withTags(NIVELES).analyze();
}

/** Formatea las violaciones para que el fallo diga qué arreglar y dónde. */
function describir(violaciones: Awaited<ReturnType<typeof auditar>>['violations']): string {
  return violaciones
    .map(
      (v) =>
        `\n[${v.impact}] ${v.id}: ${v.help}\n  ${v.nodes
          .slice(0, 3)
          .map((n) => n.target.join(' '))
          .join('\n  ')}\n  → ${v.helpUrl}`,
    )
    .join('\n');
}

test.describe('accesibilidad del embudo de compra', () => {
  for (const [nombre, ruta] of [
    ['portada', '/'],
    ['catálogo', '/tienda'],
    ['carrito', '/carrito'],
    ['checkout', '/checkout'],
    ['acceso', '/entrar'],
  ] as const) {
    test(`${nombre} sin violaciones WCAG 2.1 AA`, async ({ page }) => {
      await page.goto(ruta);
      const { violations } = await auditar(page);

      expect(violations, describir(violations)).toEqual([]);
    });
  }
});

test.describe('navegación por teclado', () => {
  test('se puede llegar al carrito solo con el teclado', async ({ page }) => {
    await page.goto('/');

    // Tabular hasta el botón del carrito y activarlo.
    const botonCarrito = page.getByRole('button', { name: /abrir carrito/i });
    await botonCarrito.focus();
    await page.keyboard.press('Enter');

    await expect(page.locator('.cart-drawer')).toHaveClass(/is-open/);
  });

  test('Escape cierra el drawer del carrito', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /abrir carrito/i }).click();
    await expect(page.locator('.cart-drawer')).toHaveClass(/is-open/);

    await page.keyboard.press('Escape');
    await expect(page.locator('.cart-drawer')).not.toHaveClass(/is-open/);
  });

  test('el foco es visible al tabular', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');

    const enfocado = page.locator(':focus');
    await expect(enfocado).toBeVisible();

    // El anillo de foco debe existir: sin él, navegar con teclado es a ciegas.
    const outline = await enfocado.evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(outline).not.toBe('none');
  });
});

test.describe('semántica para lectores de pantalla', () => {
  test('cada página tiene un único h1', async ({ page }) => {
    for (const ruta of ['/', '/tienda', '/carrito']) {
      await page.goto(ruta);
      const h1 = page.getByRole('heading', { level: 1 });
      expect(await h1.count(), `${ruta} debería tener exactamente un h1`).toBe(1);
    }
  });

  test('el idioma del documento está declarado', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  });

  test('los botones de icono tienen nombre accesible', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('button', { name: /abrir carrito/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /buscar/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /mi cuenta/i })).toBeVisible();
  });
});
