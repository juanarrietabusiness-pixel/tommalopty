import { expect, test } from '@playwright/test';
import { PANEL_URL } from '../playwright.config';

/**
 * Dos garantías de interfaz que se rompen solas y en silencio.
 *
 * Salieron de una auditoría que midió la aplicación construida en escritorio,
 * tablet y móvil. No están aquí por completitud: **las dos estaban rotas cuando
 * se midieron**, y las dos se rompen otra vez con un cambio de CSS que nadie
 * relaciona con su causa.
 */

const TIENDA = ['/', '/tienda', '/carrito', '/checkout', '/entrar', '/buscar?q=camisa'];
const PANEL = ['/', '/pedidos', '/catalogo', '/catalogo/importar', '/despacho', '/configuracion'];

/**
 * Cuánto se sale la página por el lado.
 *
 * Es la medida honesta: `scrollWidth` mayor que `clientWidth` significa que hay
 * barra horizontal, y en un móvil eso es contenido cortado por la derecha que
 * solo aparece si alguien adivina que puede arrastrar.
 */
async function anchoDesbordado(page: import('@playwright/test').Page): Promise<number> {
  return page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth - doc.clientWidth;
  });
}

test.describe('la página no se desborda a lo ancho', () => {
  /**
   * La causa siempre es la misma y siempre se disfraza distinto: un elemento de
   * rejilla o flexible nace con `min-width: auto`, no puede encoger por debajo
   * de su contenido, y una tabla ancha o una fila de botones lo estira. El
   * `overflow-x: auto` que parecía protegerlo no llega a actuar nunca.
   *
   * Se midió roto en cuatro pantallas del panel: la barra lateral, el contenido
   * con `1fr` en vez de `minmax(0, 1fr)`, y los botones de la cabecera.
   */
  for (const ruta of TIENDA) {
    test(`tienda ${ruta}`, async ({ page }) => {
      await page.goto(ruta, { waitUntil: 'networkidle' });
      expect(await anchoDesbordado(page), `${ruta} se sale por el lado`).toBeLessThanOrEqual(1);
    });
  }

  for (const ruta of PANEL) {
    test(`panel ${ruta}`, async ({ page }) => {
      await page.goto(`${PANEL_URL}${ruta}`, { waitUntil: 'networkidle' });
      expect(await anchoDesbordado(page), `${ruta} se sale por el lado`).toBeLessThanOrEqual(1);
    });
  }
});

test.describe('los campos no provocan zoom en iPhone', () => {
  /**
   * Safari en iOS **hace zoom automático** al enfocar un campo cuya letra mide
   * menos de 16px, y al hacerlo descoloca la página y deja a quien escribe
   * perdido a mitad del formulario. Es la causa más común de «el checkout se ve
   * raro en el iPhone», y no se ve en ningún navegador de escritorio.
   *
   * Solo se comprueba en el perfil móvil, que es el único que emula un
   * dispositivo táctil: la regla que lo arregla está detrás de
   * `@media (pointer: coarse)` a propósito, para no engordar los filtros del
   * panel en un escritorio donde no hay zoom que provocar.
   */
  test('en la tienda y en el panel', async ({ page }, info) => {
    test.skip(info.project.name !== 'movil', 'solo tiene sentido en un dispositivo táctil');

    for (const ruta of [...TIENDA, ...PANEL.map((r) => `${PANEL_URL}${r}`)]) {
      await page.goto(ruta, { waitUntil: 'networkidle' });

      const pequenos = await page.evaluate(() =>
        Array.from(document.querySelectorAll('input, select, textarea'))
          .filter((el) => {
            const entrada = el as HTMLInputElement;
            // Las casillas y los ocultos no reciben texto: su tamaño de letra no
            // provoca ningún zoom.
            if (['checkbox', 'radio', 'hidden'].includes(entrada.type)) return false;
            return Number.parseFloat(getComputedStyle(el).fontSize) < 16;
          })
          .map((el) => (el as HTMLInputElement).name || el.id || el.tagName),
      );

      expect(pequenos, `${ruta} tiene campos con letra menor de 16px`).toEqual([]);
    }
  });
});
