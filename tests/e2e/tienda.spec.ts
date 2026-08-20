import { expect, test } from '@playwright/test';

/**
 * Flujo de compra de la tienda pública.
 *
 * Es el camino que genera ingresos: si algo aquí se rompe, no se vende. Por eso
 * se prueba en los tres tamaños de pantalla y no solo en escritorio.
 */

test.describe('portada', () => {
  test('carga y muestra el catálogo', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // El grid debe traer productos: una portada vacía es una tienda rota.
    const tarjetas = page.locator('.product-card');
    await expect(tarjetas.first()).toBeVisible();
    expect(await tarjetas.count()).toBeGreaterThan(0);
  });

  test('muestra precio y descuento en las tarjetas', async ({ page }) => {
    await page.goto('/');

    const primera = page.locator('.product-card').first();
    await expect(primera.locator('.price-sale').first()).toContainText('$');
  });

  test('la barra de confianza comunica envío y devoluciones', async ({ page }) => {
    await page.goto('/');
    const barra = page.locator('.trust-bar');
    await expect(barra.getByText('Envío gratis', { exact: true })).toBeVisible();
    await expect(barra.getByText('Devoluciones fáciles')).toBeVisible();
  });
});

test.describe('carrito', () => {
  test('añadir un producto abre el drawer y actualiza el contador', async ({ page }) => {
    await page.goto('/');

    const contador = page.locator('.cart-count');
    await expect(contador).toHaveText('0');

    await page
      .locator('.product-card')
      .first()
      .getByRole('button', { name: /añadir/i })
      .click();

    // El drawer se abre solo: es lo que sostiene la compra por impulso.
    await expect(page.locator('.cart-drawer')).toHaveClass(/is-open/);
    await expect(contador).toHaveText('1');
    await expect(page.locator('.cart-drawer')).toContainText('Subtotal');
  });

  test('el subtotal refleja la cantidad', async ({ page }) => {
    await page.goto('/');

    const tarjeta = page.locator('.product-card').first();
    const precioTexto = (await tarjeta.locator('.price-sale').textContent()) ?? '$0';
    const precio = Number(precioTexto.replace(/[^0-9.]/g, ''));

    await tarjeta.getByRole('button', { name: /añadir/i }).click();
    await expect(page.locator('.cart-drawer')).toHaveClass(/is-open/);

    const subtotal = page.locator('.drawer-footer .subtotal span').last();
    await expect(subtotal).toHaveText(new RegExp(precio.toFixed(2).replace('.', '\\.')));
  });

  test('el carrito sobrevive a una recarga', async ({ page }) => {
    await page.goto('/');
    await page
      .locator('.product-card')
      .first()
      .getByRole('button', { name: /añadir/i })
      .click();
    await expect(page.locator('.cart-count')).toHaveText('1');

    await page.reload();

    // Persistencia en localStorage: si se pierde, se pierde la venta.
    await expect(page.locator('.cart-count')).toHaveText('1');
  });

  test('se puede vaciar quitando la línea', async ({ page }) => {
    await page.goto('/');
    await page
      .locator('.product-card')
      .first()
      .getByRole('button', { name: /añadir/i })
      .click();

    const drawer = page.locator('.cart-drawer');
    await expect(drawer).toHaveClass(/is-open/);
    await drawer
      .getByRole('button', { name: /quitar/i })
      .first()
      .click();

    await expect(drawer).toContainText('Tu carrito está vacío');
    await expect(page.locator('.cart-count')).toHaveText('0');
  });

  test('la página de carrito muestra las líneas añadidas', async ({ page }) => {
    await page.goto('/');
    await page
      .locator('.product-card')
      .first()
      .getByRole('button', { name: /añadir/i })
      .click();

    await page.goto('/carrito');
    await expect(page.getByRole('heading', { name: /tu carrito/i })).toBeVisible();
    await expect(page.locator('.cart-table')).toBeVisible();
  });
});

test.describe('checkout', () => {
  test('pide los datos y ofrece métodos de pago', async ({ page }) => {
    await page.goto('/');
    await page
      .locator('.product-card')
      .first()
      .getByRole('button', { name: /añadir/i })
      .click();

    await page.goto('/checkout');

    await expect(page.getByLabel('Correo electrónico')).toBeVisible();
    await expect(page.getByLabel('Dirección', { exact: true })).toBeVisible();
    await expect(page.locator('.payment-method').first()).toBeVisible();
  });

  test('deja claro que la tienda no recibe datos de tarjeta', async ({ page }) => {
    await page.goto('/');
    await page
      .locator('.product-card')
      .first()
      .getByRole('button', { name: /añadir/i })
      .click();
    await page.goto('/checkout');

    await expect(page.getByText(/nunca los recibe ni los almacena/i)).toBeVisible();
  });

  test('con el carrito vacío invita a volver a la tienda', async ({ page }) => {
    await page.goto('/checkout');
    await expect(page.locator('.notice-info')).toContainText(/carrito está vacío/i);
    await expect(page.getByRole('link', { name: /vuelve a la tienda/i })).toBeVisible();
  });
});

test.describe('navegación', () => {
  test('el catálogo lista productos y filtros', async ({ page }) => {
    await page.goto('/tienda');
    await expect(page.locator('.product-card').first()).toBeVisible();
  });

  test('la búsqueda responde sin resultados sin romperse', async ({ page }) => {
    await page.goto('/buscar?q=xyzabc123inexistente');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByText(/no encontramos productos/i)).toBeVisible();
  });

  test('una URL inexistente devuelve 404 con salida', async ({ page }) => {
    const response = await page.goto('/esta-pagina-no-existe');
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('link', { name: /volver al inicio/i })).toBeVisible();
  });
});
