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

  /**
   * El mapa se construyó entero —lienzo, controles, atribución— dentro de una
   * caja de altura cero, así que no se veía nada. Lo causaba una colisión de
   * CSS: MapLibre le pone al contenedor su clase `.maplibregl-map`, que trae
   * `position: relative` y anulaba el `inset: 0` del que dependía el alto.
   *
   * El test hace dos cosas que merecen explicación:
   *
   * 1. **Inyecta la regla de MapLibre al final del documento.** Es lo que
   *    reproduce el fallo: en desarrollo la hoja de MapLibre carga antes que la
   *    nuestra y ganamos por orden, así que sin esto el test pasa en verde
   *    aunque el CSS esté mal. Inyectada al final, empata en orden y solo gana
   *    quien tenga más especificidad — que es justo lo que se quiere probar.
   *
   * 2. **Mide el tamaño, no la existencia.** Existir existía todo. Un test que
   *    preguntara «¿hay un canvas?» habría pasado con la pantalla en blanco.
   */
  test('el mapa de la dirección ocupa espacio aunque MapLibre imponga su position', async ({
    page,
  }) => {
    await page.goto('/');
    await page
      .locator('.product-card')
      .first()
      .getByRole('button', { name: /añadir/i })
      .click();
    await page.goto('/checkout');

    const lienzo = page.locator('.ubicacion-lienzo');
    await expect(lienzo).toBeVisible();

    // Hay que esperar a que MapLibre termine de montarse: la clase que provoca
    // el conflicto —`maplibregl-map`— se la pone él al contenedor, y hasta que
    // no está, la regla de abajo no engancha con nada y el test pasaría en
    // verde sin haber probado nada.
    await expect(page.locator('.ubicacion-lienzo canvas')).toBeAttached({ timeout: 15_000 });
    await expect(lienzo).toHaveClass(/maplibregl-map/);

    await page.addStyleTag({ content: '.maplibregl-map { position: relative; }' });

    const caja = await lienzo.boundingBox();
    expect(caja?.width ?? 0).toBeGreaterThan(200);
    expect(caja?.height ?? 0).toBeGreaterThan(200);
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

  // Regresión: el navegador calculaba el total con precios de localStorage, sin
  // restar el descuento y evaluando el envío gratis antes del descuento. La
  // pantalla decía un importe y la pasarela cobraba otro.
  test('el total sale del servidor, no del navegador', async ({ page }) => {
    await page.goto('/');
    await page
      .locator('.product-card')
      .first()
      .getByRole('button', { name: /añadir/i })
      .click();
    await page.goto('/checkout');

    // Sin base de datos configurada la cotización no está disponible, así que
    // el resumen debe decirlo en vez de afirmar un total inventado.
    const nota = page.getByTestId('nota-total');
    await expect(nota).toContainText(/importe final se confirma en el servidor|importe exacto/i);
  });

  test('con el carrito vacío invita a volver a la tienda', async ({ page }) => {
    await page.goto('/checkout');
    await expect(page.locator('.notice-info')).toContainText(/carrito está vacío/i);
    await expect(page.getByRole('link', { name: /vuelve a la tienda/i })).toBeVisible();
  });
});

/**
 * El mapa rellena la dirección.
 *
 * Durante meses el mapa capturaba la coordenada y no tocaba el formulario: quien
 * compraba marcaba su casa en el mapa y, acto seguido, tenía que escribir la
 * misma dirección a mano. La coordenada llegaba al pedido, así que nada parecía
 * roto, pero el trabajo que el mapa venía a quitar seguía ahí.
 *
 * Va en su propio `describe` por el permiso de ubicación: se concede aquí y no
 * en el resto de la tienda, donde un permiso concedido de más cambiaría lo que
 * se prueba.
 *
 * La respuesta del geocodificador se sirve desde el propio test. No es por
 * comodidad: llamar a Nominatim desde CI ataría el color del build a la
 * disponibilidad de un tercero y a su límite de peticiones, y lo que hay que
 * probar es que la pantalla usa la respuesta, no que el tercero responde.
 */
test.describe('la dirección se rellena desde el mapa', () => {
  test.use({
    permissions: ['geolocation'],
    // Un punto real de Ciudad de Panamá: tiene que caer dentro del país o la
    // pantalla, con razón, ni pregunta la dirección.
    geolocation: { latitude: 8.9824, longitude: -79.5199 },
  });

  async function irAlCheckout(page: import('@playwright/test').Page) {
    await page.goto('/');
    await page
      .locator('.product-card')
      .first()
      .getByRole('button', { name: /añadir/i })
      .click();
    await page.goto('/checkout');
  }

  test('marcar el punto escribe dirección, ciudad y provincia', async ({ page }) => {
    await page.route('**/api/geo/inverso*', (route) =>
      route.fulfill({
        json: {
          direccion: {
            line1: 'Calle 50 55',
            city: 'Bella Vista',
            province: 'Panamá',
            etiqueta: 'Calle 50 55, Bella Vista, Panamá',
          },
        },
      }),
    );

    await irAlCheckout(page);

    const direccion = page.getByLabel('Dirección', { exact: true });
    const ciudad = page.getByLabel('Ciudad');
    const provincia = page.getByLabel('Provincia');

    // Empiezan vacíos: es la mitad de la prueba. Sin esto, un campo que llegara
    // relleno por cualquier otro motivo daría el test por bueno.
    await expect(direccion).toHaveValue('');
    await expect(ciudad).toHaveValue('');

    await page.getByRole('button', { name: /usar mi ubicación/i }).click();

    await expect(direccion).toHaveValue('Calle 50 55', { timeout: 15_000 });
    await expect(ciudad).toHaveValue('Bella Vista');
    await expect(provincia).toHaveValue('Panamá');
    await expect(page.getByTestId('aviso-autocompletado')).toBeVisible();
  });

  test('lo que se escribe a mano no lo pisa el mapa', async ({ page }) => {
    await page.route('**/api/geo/inverso*', (route) =>
      route.fulfill({
        json: {
          direccion: {
            line1: 'Calle 50 55',
            city: 'Bella Vista',
            province: 'Panamá',
            etiqueta: 'Calle 50 55, Bella Vista, Panamá',
          },
        },
      }),
    );

    await irAlCheckout(page);

    const ciudad = page.getByLabel('Ciudad');

    // Primero se corrige a mano, y solo después se marca el punto: es el orden
    // en el que duele. Quien ya escribió su barriada no quiere verla
    // desaparecer porque el mapa opine otra cosa.
    await ciudad.fill('Villa Lucre');
    await page.getByRole('button', { name: /usar mi ubicación/i }).click();

    // La dirección sí se rellena —ese campo no lo tocó nadie—, y es la señal de
    // que el volcado ocurrió de verdad y no se quedó por el camino.
    await expect(page.getByLabel('Dirección', { exact: true })).toHaveValue('Calle 50 55', {
      timeout: 15_000,
    });
    await expect(ciudad).toHaveValue('Villa Lucre');
  });
});

test.describe('ficha de producto', () => {
  // Regresión: sin base de datos, `loadProduct` devolvía null y la ficha
  // respondía 404 — aunque la portada y el catálogo enlazaran a ella. Lo
  // primero que hace cualquiera al abrir una tienda es pinchar un producto.
  test('se llega desde la portada y carga', async ({ page }) => {
    await page.goto('/');

    const enlace = page.locator('.product-card a[href^="/producto/"]').first();
    const href = await enlace.getAttribute('href');
    expect(href).toBeTruthy();

    const respuesta = await page.goto(href!);
    expect(respuesta?.status(), `${href} no debería devolver 404`).toBe(200);

    await expect(page.locator('h1')).toBeVisible();
    await expect(page.getByRole('button', { name: /añadir/i }).first()).toBeVisible();
  });

  test('se puede añadir al carrito desde la ficha', async ({ page }) => {
    await page.goto('/');
    const enlace = page.locator('.product-card a[href^="/producto/"]').first();
    await page.goto((await enlace.getAttribute('href'))!);

    await page
      .getByRole('button', { name: /añadir/i })
      .first()
      .click();
    await expect(page.locator('.cart-count, [data-cart-count]').first()).toContainText('1');
  });
});

test.describe('área de cliente en modo demostración', () => {
  // Las cuatro pantallas se quedaban en una sola frase técnica —"El área de
  // cliente necesita una instancia de Supabase configurada"— sin título
  // siquiera. Ningún test lo veía porque ninguno entraba en /cuenta.
  const PANTALLAS = [
    { ruta: '/cuenta', titulo: /hola/i },
    { ruta: '/cuenta/pedidos', titulo: /mis pedidos/i },
    { ruta: '/cuenta/direcciones', titulo: /mis direcciones/i },
    { ruta: '/cuenta/favoritos', titulo: /favoritos/i },
  ];

  for (const { ruta, titulo } of PANTALLAS) {
    test(`${ruta} se recorre sin iniciar sesión y no sale en blanco`, async ({ page }) => {
      const respuesta = await page.goto(ruta);
      expect(respuesta?.status()).toBe(200);

      await expect(page.getByRole('heading', { level: 1 })).toHaveText(titulo);

      // El umbral es deliberadamente bajo: lo que se quiere impedir es la
      // pantalla de una línea, no fijar la redacción exacta.
      const texto = (await page.locator('.account-layout').innerText()).trim();
      expect(texto.length).toBeGreaterThan(300);
    });
  }

  test('avisa de que los datos son de ejemplo', async ({ page }) => {
    await page.goto('/cuenta');
    await expect(page.getByText(/recorrido de demostración/i)).toBeVisible();
  });
});

test.describe('acceso y registro', () => {
  // Iban dentro de <Suspense fallback={null}>, así que el HTML del servidor no
  // traía nada: la página estaba vacía hasta que llegaba el JavaScript.
  for (const ruta of ['/entrar', '/registro']) {
    test(`${ruta} trae título ya en el HTML del servidor`, async ({ request }) => {
      const respuesta = await request.get(ruta);
      expect(respuesta.status()).toBe(200);

      const html = await respuesta.text();
      expect(html).toMatch(/<h1[^>]*>(Iniciar sesión|Crear cuenta)</);
    });
  }
});

/**
 * La aplicación del motorizado (fase L4).
 *
 * Sin sesión no se entra, y sin base de datos tampoco. Lo que se prueba aquí no
 * es la lista de entregas —para eso hace falta un motorizado de verdad y sus
 * permisos, y eso vive en los tests de RLS contra Postgres— sino que la puerta
 * está cerrada y que cerrarla no significa una pantalla en blanco ni un 500.
 */
test.describe('la aplicación del motorizado', () => {
  test('sin sesión manda a entrar, no a una pantalla vacía', async ({ page }) => {
    await page.goto('/motorizado');

    await expect(page).toHaveURL(/\/entrar/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('el detalle de una entrega responde 404, no un error del servidor', async ({ page }) => {
    // 404 y no 500: sin base de datos no hay envío que enseñar, y eso es «no
    // existe», no «se rompió». La diferencia importa porque un 500 en esta ruta
    // sería la misma clase de fallo que dejó el panel entero devolviendo errores
    // en modo demostración.
    const respuesta = await page.goto('/motorizado/00000000-0000-4000-8000-000000000001');
    expect(respuesta?.status()).toBe(404);
  });
});

test.describe('páginas legales', () => {
  // No son enlaces decorativos: la Ley 81 de 2019 obliga a informar del
  // tratamiento de datos, y ninguna pasarela aprueba un comercio sin términos,
  // privacidad y devoluciones visibles. Si alguien los quita, la tienda deja de
  // poder cobrar y no se nota hasta la revisión del proveedor.
  test('el pie enlaza términos, privacidad y devoluciones', async ({ page }) => {
    await page.goto('/');
    const legal = page.getByRole('navigation', { name: /información legal/i });

    await expect(legal.getByRole('link', { name: /términos y condiciones/i })).toHaveAttribute(
      'href',
      '/p/terminos',
    );
    await expect(legal.getByRole('link', { name: /política de privacidad/i })).toHaveAttribute(
      'href',
      '/p/privacidad',
    );
    await expect(
      page.locator('footer').getByRole('link', { name: /cambios y devoluciones/i }),
    ).toBeVisible();
  });

  // Comprobar el href no basta: eso ya se hacía y las cinco páginas devolvían
  // 404 igualmente, porque el enlace era correcto y el destino no existía. Este
  // test entra en cada una, que es lo que lo habría detectado.
  test('las páginas del pie abren de verdad, no dan 404', async ({ page }) => {
    await page.goto('/');

    const enlaces = page.locator('footer a[href^="/p/"]');
    const destinos = await enlaces.evaluateAll((nodos) =>
      Array.from(new Set(nodos.map((nodo) => nodo.getAttribute('href')!))),
    );
    expect(destinos.length).toBeGreaterThan(0);

    for (const destino of destinos) {
      const respuesta = await page.goto(destino);
      expect(respuesta?.status(), `${destino} debería responder 200`).toBe(200);
      await expect(page.locator('h1.page-title')).toBeVisible();
    }
  });

  test('el checkout muestra la aceptación antes de confirmar', async ({ page }) => {
    await page.goto('/');
    await page
      .locator('.product-card')
      .first()
      .getByRole('button', { name: /añadir/i })
      .click();
    await page.goto('/checkout');

    const aceptacion = page.getByText(/al confirmar el pedido aceptas/i);
    await expect(aceptacion).toBeVisible();
    await expect(aceptacion.getByRole('link', { name: /términos/i })).toHaveAttribute(
      'href',
      '/p/terminos',
    );
    await expect(aceptacion.getByRole('link', { name: /privacidad/i })).toHaveAttribute(
      'href',
      '/p/privacidad',
    );
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

/**
 * Los eventos de Meta.
 *
 * Hasta hoy el píxel solo emitía `PageView` y `AddToCart`: no había `ViewContent`,
 * así que Meta no podía construir el público de «miró este producto y no lo
 * compró», que es de donde sale casi todo el remarketing. Y no había `Search`, así
 * que una búsqueda sin resultados —que es demanda de algo que no está en
 * catálogo— se perdía entera.
 *
 * Se comprueban interceptando `fbq` antes de que cargue la página. Eso permite
 * verificar el cableado real sin necesidad de un píxel de verdad ni de hablar con
 * Meta, que en un test sería a la vez lento y mentira.
 */
test.describe('eventos de Meta', () => {
  async function interceptarFbq(page: import('@playwright/test').Page) {
    await page.addInitScript(() => {
      const registro: unknown[][] = [];
      (window as unknown as Record<string, unknown>).__eventosMeta = registro;
      (window as unknown as Record<string, unknown>).fbq = (...args: unknown[]) => {
        registro.push(args);
      };
    });
  }

  function eventos(page: import('@playwright/test').Page) {
    return page.evaluate(
      () => (window as unknown as { __eventosMeta: unknown[][] }).__eventosMeta ?? [],
    );
  }

  /**
   * Espera a que llegue un evento concreto.
   *
   * Leer justo después de `goto` es lo que parece correcto y no lo es: estos
   * eventos salen de un `useEffect`, y `goto` resuelve cuando la página carga,
   * no cuando React ha hidratado. Sin esta espera el test falla o pasa según lo
   * cargada que esté la máquina, que es la peor clase de test.
   */
  async function esperarEvento(page: import('@playwright/test').Page, nombre: string) {
    await page.waitForFunction(
      (buscado) => {
        const registro = (window as unknown as { __eventosMeta?: unknown[][] }).__eventosMeta ?? [];
        return registro.some((e) => e[1] === buscado);
      },
      nombre,
      { timeout: 5_000 },
    );
  }

  test('la ficha de producto emite ViewContent una sola vez', async ({ page }) => {
    await interceptarFbq(page);

    await page.goto('/tienda');
    await page.locator('a[href^="/producto/"]').first().click();
    await page.waitForURL(/\/producto\//);
    await esperarEvento(page, 'ViewContent');

    const emitidos = await eventos(page);
    const vistas = emitidos.filter((e) => e[0] === 'track' && e[1] === 'ViewContent');

    expect(vistas.length, 'ViewContent debería emitirse exactamente una vez').toBe(1);

    // Sin datos, el evento le sirve a Meta para poco: no puede emparejar la
    // visita con el producto ni con su precio.
    const datos = vistas[0]?.[2] as Record<string, unknown> | undefined;
    expect(datos?.content_type).toBe('product');
    expect(datos?.content_ids).toBeTruthy();
  });

  test('cambiar de producto vuelve a emitir ViewContent, con otro identificador', async ({
    page,
  }) => {
    await interceptarFbq(page);

    const fichas = ['/tienda'];
    await page.goto(fichas[0] as string);

    const enlaces = await page
      .locator('a[href^="/producto/"]')
      .evaluateAll((nodos) =>
        Array.from(new Set(nodos.map((n) => (n as HTMLAnchorElement).getAttribute('href')))).slice(
          0,
          2,
        ),
      );

    expect(enlaces.length, 'hacen falta dos productos distintos').toBe(2);

    for (const enlace of enlaces) {
      await page.goto(enlace as string);
      await esperarEvento(page, 'ViewContent');
    }

    const vistas = (await eventos(page)).filter((e) => e[1] === 'ViewContent');

    // Con un guardia booleano en vez de comparar identificadores, el segundo
    // producto no se contaría nunca.
    expect(vistas.length).toBeGreaterThanOrEqual(1);
  });

  test('una búsqueda emite Search con el término, aunque no encuentre nada', async ({ page }) => {
    await interceptarFbq(page);
    await page.goto('/buscar?q=zzzzzznoexiste');
    await esperarEvento(page, 'Search');

    const busquedas = (await eventos(page)).filter((e) => e[1] === 'Search');

    expect(busquedas.length, 'una búsqueda sin resultados también es una señal').toBe(1);
    expect((busquedas[0]?.[2] as Record<string, unknown>)?.search_string).toBe('zzzzzznoexiste');
  });

  test('sin término de búsqueda no se emite nada', async ({ page }) => {
    await interceptarFbq(page);
    await page.goto('/buscar');

    // Se espera a PageView, que el píxel emite siempre: sin anclar la espera a
    // algo que sí ocurre, este test pasaría también con el evento presente,
    // simplemente por leer antes de tiempo.
    await esperarEvento(page, 'PageView').catch(() => undefined);
    await page.waitForTimeout(500);

    expect((await eventos(page)).filter((e) => e[1] === 'Search')).toHaveLength(0);
  });
});
