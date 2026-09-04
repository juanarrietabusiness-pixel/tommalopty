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
  { nombre: 'importar productos', ruta: '/catalogo/importar' },
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

  /**
   * El importador de productos.
   *
   * Lo que estos tests protegen no es la comodidad: es que **nadie pueda
   * importar sin haber visto antes qué se entendió**. Un fichero de proveedor
   * con la columna de precio donde va el peso mete mil productos mal valorados,
   * y para cuando alguien lo nota ya se vendió alguno.
   */
  test.describe('importar productos', () => {
    const CSV = [
      'Titulo,Precio,SKU,Existencias',
      'Camisa blanca,19.90,CAM-01,12',
      '"Auriculares, 40h de batería",49.99,AUR-02,5',
      ',25.00,SIN-TITULO,1',
    ].join('\n');

    async function pegar(page: import('@playwright/test').Page, csv: string) {
      await page.goto(`${PANEL_URL}/catalogo/importar`);
      await page.getByLabel(/pega las filas/i).fill(csv);
    }

    test('no se puede importar nada hasta pegar un fichero', async ({ page }) => {
      await page.goto(`${PANEL_URL}/catalogo/importar`);

      await expect(page.getByRole('button', { name: /importar \d/i })).toHaveCount(0);
    });

    test('al pegar, propone qué columna es cada campo', async ({ page }) => {
      await pegar(page, CSV);

      // Reconocidas solas, sin que nadie las configure.
      await expect(page.getByLabel('Título')).toHaveValue('0');
      await expect(page.getByLabel('Precio', { exact: false }).first()).toHaveValue('1');
    });

    /**
     * La propiedad central: se ve cómo quedó cada precio **antes** de guardar.
     * Sin esto, que «1.299» se leyera como uno con veintinueve no se descubre
     * hasta que alguien compra.
     */
    test('enseña qué entendió de cada precio', async ({ page }) => {
      await pegar(page, 'Titulo,Precio\nCamisa,"1.299,00"');

      await expect(page.getByText('1.299,00 → 1299.00')).toBeVisible();
    });

    test('un título con comas dentro no se parte en columnas', async ({ page }) => {
      await pegar(page, CSV);

      // Se busca la **celda**, no el texto suelto: el texto también está en el
      // textarea donde se pegó, y lo que se afirma aquí es que la fila produjo
      // una sola columna con el título entero, no que el texto exista.
      await expect(
        page.getByRole('cell', { name: 'Auriculares, 40h de batería', exact: true }),
      ).toBeVisible();
    });

    test('dice qué filas descarta y por qué, en vez de tragárselas', async ({ page }) => {
      await pegar(page, CSV);

      await expect(page.getByText(/1 fila se descarta/i)).toBeVisible();
      await page.getByText(/ver cuáles/i).click();
      await expect(page.getByText(/sin título/i)).toBeVisible();
    });

    test('sin columna de precio no deja importar, y dice qué falta', async ({ page }) => {
      await pegar(page, 'Marca,Color\nNike,Rojo');

      await expect(page.getByText(/falta indicar/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /importar \d/i })).toHaveCount(0);
    });

    test('corregir una columna a mano cambia la previsualización', async ({ page }) => {
      // Encabezados que no reconoce solo: es el caso para el que existe el
      // selector, y si no funcionara la pantalla solo serviría con ficheros
      // que ya vienen bien.
      await pegar(page, 'Col A,Col B\nCamisa,19.90');
      await expect(page.getByText(/falta indicar/i)).toBeVisible();

      await page.getByLabel('Título').selectOption('0');
      await page.getByLabel('Precio', { exact: false }).first().selectOption('1');

      await expect(page.getByText(/falta indicar/i)).toHaveCount(0);
      await expect(page.getByRole('button', { name: /importar 1/i })).toBeVisible();
    });

    test('avisa de que todo entra como borrador', async ({ page }) => {
      await pegar(page, CSV);

      // Publicar automáticamente pondría descripciones y fotos ajenas en la
      // tienda en el mismo segundo. Que se diga es parte de la función.
      await expect(page.getByText(/borrador/i).first()).toBeVisible();
    });
  });
});

/**
 * Las tres pantallas que el panel no tenía (#47).
 *
 * Las 25 pantallas son `force-dynamic` y consultan la base antes de pintar
 * nada, y no había ni `loading.tsx`, ni `error.tsx`, ni `not-found.tsx`. Se
 * notaba en dos sitios: al pulsar un enlace del menú no pasaba nada visible
 * hasta que respondía el servidor, y un registro borrado caía en el 404 pelado
 * de Next —sin menú, sin vuelta atrás— en mitad de una sesión iniciada.
 */
test.describe('panel · carga, error y no encontrado', () => {
  test('una dirección que no existe cae dentro del panel, con su menú', async ({ page }) => {
    await page.goto(`${PANEL_URL}/esta-ruta-no-existe`);

    await expect(page.getByRole('heading', { name: /aquí no hay nada/i })).toBeVisible();
    // Lo que lo diferencia del 404 por defecto: sigue habiendo por dónde salir.
    await expect(page.getByRole('navigation', { name: /navegación del panel/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /ir al resumen/i })).toBeVisible();
  });

  test('un registro que ya no existe también', async ({ page }) => {
    // El caso real: alguien abre el enlace guardado de un pedido que se borró.
    await page.goto(`${PANEL_URL}/catalogo/${ID('ffff')}`);

    await expect(page.getByRole('heading', { name: /aquí no hay nada/i })).toBeVisible();
  });

  test('el enlace pulsado avisa de que está trabajando', async ({ page }) => {
    // El fallo tal y como se sentía: pulsas una sección, no pasa nada visible
    // hasta que responde el servidor, y vuelves a pulsar.
    //
    // Se retrasa la respuesta a propósito, porque el servidor de demostración
    // contesta al instante y esto solo aparece cuando la base tarda — que es
    // exactamente el caso para el que existe. El retraso alcanza también a la
    // precarga, y tiene que alcanzarla: Next pide `/clientes` en cuanto el
    // enlace entra en pantalla, así que al pulsar ya la tendría hecha. Por eso
    // la ruta se instala ANTES de abrir la página.
    //
    // Retrasarla, no descartarla: si la precarga falla, Next se cae a una
    // navegación de documento completo y esto no participa. El test daría
    // negativo por el motivo equivocado.
    await page.route('**/clientes**', async (route) => {
      await new Promise((listo) => setTimeout(listo, 1500));
      await route.continue();
    });

    await page.goto(`${PANEL_URL}/`);
    await page.getByRole('link', { name: 'Clientes / CRM' }).click();

    // `toBeAttached` y no `toBeVisible`: lo que se afirma es el texto para
    // lectores de pantalla, que va oculto a la vista a propósito. El punto que
    // gira es su equivalente visible.
    await expect(page.getByText('Cargando Clientes / CRM')).toBeAttached();
  });
});

/**
 * Las acciones que existían y no tenía a mano nadie (#45).
 *
 * `archiveProduct`, `deleteBanner`, `toggleCategory` y `toggleDiscount` estaban
 * escritas y funcionando, y ninguna tenía un llamador: cero referencias fuera
 * del fichero donde se definen. La consecuencia era que una categoría o un
 * código de descuento, una vez creados, no se podían desactivar por ninguna
 * vía — la columna «Estado» del listado solo podía decir «Activo», para
 * siempre.
 *
 * Estos tests fijan que el mando existe en la pantalla. No comprueban el
 * efecto, que es de la acción de servidor y aquí está bloqueada por el modo
 * demostración: comprueban justo lo que faltaba, que es poder llegar a ella.
 */
test.describe('panel · las acciones llegan a la pantalla', () => {
  test('una categoría se puede desactivar desde el listado', async ({ page }) => {
    await page.goto(`${PANEL_URL}/catalogo/categorias`);

    await expect(page.getByRole('button', { name: /desactivar la categoría café/i })).toBeVisible();
  });

  test('un código de descuento se puede desactivar desde el listado', async ({ page }) => {
    // El más caro de los cuatro: sin esto, un código publicado por error no se
    // podía apagar. Solo caducaba, si alguien le puso fecha al crearlo.
    await page.goto(`${PANEL_URL}/descuentos`);

    await expect(
      page.getByRole('button', { name: /desactivar el código bienvenida10/i }),
    ).toBeVisible();
  });

  test('un producto se puede archivar desde su ficha', async ({ page }) => {
    await page.goto(`${PANEL_URL}/catalogo/${ID('p1')}`);

    await expect(page.getByRole('button', { name: 'Archivar' })).toBeVisible();
  });

  test('un banner se puede borrar desde su tarjeta', async ({ page }) => {
    await page.goto(`${PANEL_URL}/contenido/banners`);

    await expect(page.getByRole('button', { name: 'Borrar' }).first()).toBeVisible();
  });
});

/**
 * La paginación de pedidos y clientes (#48).
 *
 * Las dos pantallas traían 50 filas, enseñaban el total completo en la cabecera
 * —«1.240 pedidos registrados»— y no ofrecían página siguiente. Un pedido de
 * hace dos meses era inalcanzable salvo que se recordara su número.
 *
 * El paginador en sí no sale aquí: con ocho pedidos de demostración cabe todo
 * en una página y el pie se oculta a propósito. Lo que sí se puede comprobar
 * con estos datos es el fallo que de verdad muerde, que es pedir una página que
 * no existe — y ese caso no depende de cuántas filas haya.
 *
 * Tampoco hay aquí un test de `?pagina=abc`, y no por olvido: se escribió, y
 * **pasaba igual con `parsePagina` sin validar**. Un `NaN` acaba en
 * `slice(NaN, NaN)`, que devuelve la lista entera, así que la pantalla se ve
 * bien y el test no distingue nada. Esa guarda se prueba donde sí puede fallar,
 * en `packages/ui/src/admin/paginar.test.ts`.
 */
test.describe('panel · paginación', () => {
  for (const [nombre, ruta, vacio] of [
    ['pedidos', '/pedidos', 'Todavía no hay pedidos'],
    ['clientes', '/clientes', 'Todavía no hay clientes'],
  ] as const) {
    test(`${nombre}: una página que no existe no enseña una tabla vacía`, async ({ page }) => {
      // Un enlace guardado, o un filtro que redujo la lista. Sin sujetar la
      // página al rango, la consulta pide un offset más allá del final y la
      // pantalla queda vacía debajo del total completo: la contradicción que
      // este issue venía a quitar.
      await page.goto(`${PANEL_URL}${ruta}?pagina=900`);

      await expect(page.getByText(vacio)).toHaveCount(0);
      // Y se corrige la dirección, en vez de dejarla mintiendo.
      //
      // Con `expect.poll` y no leyendo `page.url()` una vez: Next resuelve el
      // `redirect()` sirviendo ya el contenido correcto —arriba se comprueba—
      // y ajustando el historial justo después, así que un muestreo único de
      // la dirección llega antes de tiempo. Sola pasaba y dentro de la suite
      // completa fallaba, que es como se ve un test que mide un instante en
      // vez de un resultado.
      await expect.poll(() => new URL(page.url()).searchParams.get('pagina')).toBeNull();
    });
  }
});
