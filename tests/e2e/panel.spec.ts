import { expect, test } from '@playwright/test';
import { PANEL_URL } from '../playwright.config';

/**
 * El recorrido de demostración del panel.
 *
 * Motivo de existir: sin Supabase configurado, las dieciocho pantallas del
 * panel devolvían HTTP 500 y solo renderizaba la de acceso. El panel estaba
 * construido y no se le podía enseñar a nadie. Estos tests fijan que se puede
 * recorrer entero, y que se ve que es una demostración.
 *
 * Corren contra un servidor propio, levantado SIN las variables de Supabase.
 */

/** Ids deterministas de `apps/admin/src/lib/demo-data.ts`. */
const ID = (sufijo: string) => `00000000-0000-4000-8000-${sufijo.padStart(12, '0')}`;

const PANTALLAS = [
  { nombre: 'dashboard', ruta: '/' },
  { nombre: 'pedidos', ruta: '/pedidos' },
  { nombre: 'detalle de pedido', ruta: `/pedidos/${ID('o1')}` },
  { nombre: 'clientes', ruta: '/clientes' },
  { nombre: 'ficha de cliente', ruta: `/clientes/${ID('u1')}` },
  { nombre: 'catálogo', ruta: '/catalogo' },
  { nombre: 'editar producto', ruta: `/catalogo/${ID('p1')}` },
  { nombre: 'producto nuevo', ruta: '/catalogo/nuevo' },
  { nombre: 'categorías', ruta: '/catalogo/categorias' },
  { nombre: 'inventario', ruta: '/catalogo/inventario' },
  { nombre: 'descuentos', ruta: '/descuentos' },
  { nombre: 'banners', ruta: '/contenido/banners' },
  { nombre: 'páginas', ruta: '/contenido/paginas' },
  { nombre: 'editar página', ruta: `/contenido/paginas/${ID('g1')}` },
  { nombre: 'reportes', ruta: '/reportes' },
  { nombre: 'usuarios', ruta: '/usuarios' },
  { nombre: 'despacho', ruta: '/despacho' },
  { nombre: 'reparto y despacho', ruta: '/configuracion/zonas' },
  { nombre: 'motorizados', ruta: '/motorizados' },
  { nombre: 'integraciones', ruta: '/configuracion' },
] as const;

test.describe('panel · recorrido de demostración', () => {
  for (const pantalla of PANTALLAS) {
    test(`${pantalla.nombre} se puede abrir sin base de datos`, async ({ page }) => {
      const respuesta = await page.goto(`${PANEL_URL}${pantalla.ruta}`);
      expect(respuesta?.status(), `${pantalla.ruta} debería responder 200`).toBe(200);
    });
  }

  test('todas las pantallas avisan de que es una demostración', async ({ page }) => {
    // Cifras inventadas sin decirlo es cómo alguien decide sobre datos que no
    // existen. El aviso no es decorativo.
    for (const ruta of ['/', '/pedidos', '/reportes', '/configuracion']) {
      await page.goto(`${PANEL_URL}${ruta}`);
      await expect(page.getByText(/recorrido de demostración/i).first()).toBeVisible();
    }
  });

  test('el dashboard pinta cifras, no huecos', async ({ page }) => {
    await page.goto(`${PANEL_URL}/`);
    await expect(page.getByText('Ingresos')).toBeVisible();
    await expect(page.locator('.stat-card').first()).toContainText('$');
    await expect(page.locator('.data-table tbody tr').first()).toBeVisible();
  });

  test('el gráfico de ventas dibuja barras con altura', async ({ page }) => {
    // Regresión: `.bar-chart-col` no tenía altura definida, así que el
    // `height: %` de cada barra no resolvía contra nada y todas colapsaban al
    // `min-height` de 2px. El gráfico salía vacío con cualquier dato, también
    // con datos reales.
    await page.goto(`${PANEL_URL}/reportes`);

    const barras = page.locator('.bar-chart-bar');
    await expect(barras.first()).toBeVisible();

    const alturas = await barras.evaluateAll((nodos) =>
      nodos.map((nodo) => nodo.getBoundingClientRect().height),
    );

    expect(alturas.length).toBeGreaterThan(5);
    expect(Math.max(...alturas)).toBeGreaterThan(20);
  });

  test('no se puede guardar nada: es solo lectura', async ({ page }) => {
    await page.goto(`${PANEL_URL}/contenido/banners`);

    const guardar = page.getByRole('button', { name: /guardar/i }).first();
    await expect(guardar).toBeVisible();
    await guardar.click();

    await expect(page.getByText(/no se guarda nada|demostración/i).first()).toBeVisible();
  });

  /**
   * La pantalla de integraciones.
   *
   * Existía como una rejilla de tarjetas grandes que crecía con cada pasarela:
   * con seis ya había que hacer scroll para ver el estado de la última. Estos
   * tests fijan las dos propiedades que la arreglan —agrupada y plegada— y una
   * tercera que no es de comodidad sino de seguridad.
   */
  test.describe('integraciones', () => {
    test('están agrupadas por para qué sirven', async ({ page }) => {
      await page.goto(`${PANEL_URL}/configuracion`);

      for (const grupo of ['Cobrar', 'Publicidad y medición', 'Correo']) {
        await expect(page.getByRole('heading', { name: grupo })).toBeVisible();
      }
    });

    test('llegan plegadas, que es lo que evita el scroll infinito', async ({ page }) => {
      await page.goto(`${PANEL_URL}/configuracion`);

      const filas = page.locator('details.integracion');
      expect(await filas.count()).toBeGreaterThan(5);

      // Ninguna abierta: con nueve integraciones abiertas la pantalla mide
      // varias pantallas de alto y no se ve el estado de un vistazo.
      expect(await page.locator('details.integracion[open]').count()).toBe(0);
    });

    test('una fila se abre y enseña sus campos', async ({ page }) => {
      await page.goto(`${PANEL_URL}/configuracion`);

      const yappy = page.locator('details.integracion').filter({ hasText: 'Botón de Pago' });
      await yappy.locator('summary').click();

      await expect(yappy.getByLabel(/clave secreta/i)).toBeVisible();
    });

    /**
     * La propiedad que de verdad importa: **el campo de un secreto nace vacío.**
     *
     * Rellenarlo con el valor guardado sería lo cómodo, y pondría la clave de
     * Yappy en el HTML de la página, en la memoria de la pestaña y al alcance de
     * cualquier extensión que lea formularios. Se enseña la pista en el
     * `placeholder`, que no es un valor y no se envía al guardar.
     */
    test('los campos de secreto nacen vacíos y son de tipo contraseña', async ({ page }) => {
      await page.goto(`${PANEL_URL}/configuracion`);

      for (const fila of await page.locator('details.integracion').all()) {
        await fila.locator('summary').click();
      }

      const secretos = page.locator('details.integracion input[type="password"]');
      expect(await secretos.count()).toBeGreaterThan(3);

      for (const campo of await secretos.all()) {
        expect(await campo.inputValue()).toBe('');
      }
    });

    test('dice qué integraciones están esperando algo de fuera', async ({ page }) => {
      await page.goto(`${PANEL_URL}/configuracion`);

      // Sin esto, «¿por qué no puedo cobrar con Yappy?» es una pregunta que
      // alguien hace por teléfono en vez de leerla en la propia fila.
      await expect(page.getByText(/En espera/i).first()).toBeVisible();
    });
  });
});
