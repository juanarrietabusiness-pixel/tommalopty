import { describe, expect, it } from 'vitest';
import { analizar, detectarColumnas, leerEntero, leerPrecio } from './importacion';

describe('leerPrecio', () => {
  it('lee un número simple', () => {
    expect(leerPrecio('19.90').valor).toBe(19.9);
    expect(leerPrecio('45').valor).toBe(45);
  });

  it('quita el símbolo de moneda y los espacios', () => {
    expect(leerPrecio('$19.90').valor).toBe(19.9);
    expect(leerPrecio('US$ 45.00').valor).toBe(45);
    expect(leerPrecio(' 19.90 USD ').valor).toBe(19.9);
    expect(leerPrecio('B/. 12.50').valor).toBe(12.5);
  });

  /**
   * El balboa lleva un punto en su propio símbolo, y eso rompía el precio de una
   * forma silenciosa y cara: `B/. 12.50` se limpiaba a `.12.50`, dos puntos, y la
   * regla de millares lo leía como 1250. Cien veces el precio, en la moneda del
   * país donde está la tienda.
   */
  it('el símbolo del balboa no se cuela como separador de millares', () => {
    expect(leerPrecio('B/. 12.50').valor).toBe(12.5);
    expect(leerPrecio('B/.12.50').valor).toBe(12.5);
    expect(leerPrecio('B/. 1,299.00').valor).toBe(1299);
    expect(leerPrecio('B/. 45').valor).toBe(45);
  });

  it('un separador suelto al final tampoco cuenta', () => {
    expect(leerPrecio('19.90.').valor).toBe(19.9);
    expect(leerPrecio('45,').valor).toBe(45);
  });

  /**
   * El caso que cambia un precio por mil si se hace mal. Con los dos separadores
   * presentes manda el último, y eso resuelve inglés y español sin preguntar.
   */
  it('con punto y coma, el último manda', () => {
    expect(leerPrecio('1,299.00').valor).toBe(1299);
    expect(leerPrecio('1.299,00').valor).toBe(1299);
    expect(leerPrecio('$12,345.67').valor).toBe(12345.67);
    expect(leerPrecio('12.345,67').valor).toBe(12345.67);
  });

  it('un separador con dos dígitos detrás es decimal', () => {
    expect(leerPrecio('19,90').valor).toBe(19.9);
    expect(leerPrecio('19.90').valor).toBe(19.9);
  });

  it('un separador con un dígito detrás es decimal', () => {
    expect(leerPrecio('19,5').valor).toBe(19.5);
  });

  // Un precio con tres decimales no existe en una tienda; mil quinientos sí.
  it('un separador con tres dígitos detrás es de millares', () => {
    expect(leerPrecio('1,500').valor).toBe(1500);
    expect(leerPrecio('1.500').valor).toBe(1500);
  });

  it('varios separadores iguales son millares repetidos', () => {
    expect(leerPrecio('1.234.567').valor).toBe(1234567);
    expect(leerPrecio('1,234,567').valor).toBe(1234567);
  });

  // Adivinar aquí es exactamente lo que no hay que hacer.
  it('lo que no se puede decidir se rechaza en vez de adivinarse', () => {
    expect(leerPrecio('19,9012').valor).toBeNull();
    expect(leerPrecio('19,9012').interpretacion).toMatch(/ambiguo/);
  });

  it('rechaza lo que no es un número', () => {
    expect(leerPrecio('consultar').valor).toBeNull();
    expect(leerPrecio('').valor).toBeNull();
    expect(leerPrecio('-').valor).toBeNull();
  });

  it('rechaza los negativos: un precio negativo es un dato roto', () => {
    expect(leerPrecio('-19.90').valor).toBeNull();
    expect(leerPrecio('-19.90').interpretacion).toMatch(/negativo/);
  });

  /**
   * La red de seguridad de verdad: quien importa ve qué se entendió antes de que
   * se escriba una sola fila.
   */
  it('siempre dice qué entendió', () => {
    expect(leerPrecio('$1,299.00').interpretacion).toBe('$1,299.00 → 1299.00');
    expect(leerPrecio('1.299,00').interpretacion).toBe('1.299,00 → 1299.00');
  });

  it('el cero es un precio válido: hay productos gratis', () => {
    expect(leerPrecio('0').valor).toBe(0);
    expect(leerPrecio('0.00').valor).toBe(0);
  });
});

describe('leerEntero', () => {
  it('lee cantidades', () => {
    expect(leerEntero('12')).toBe(12);
    expect(leerEntero(' 5 ')).toBe(5);
  });

  it('descarta los decimales: media camisa no existe', () => {
    expect(leerEntero('12.7')).toBe(127);
  });

  it('devuelve null con lo que no es una cantidad', () => {
    expect(leerEntero('')).toBeNull();
    expect(leerEntero('muchos')).toBeNull();
    expect(leerEntero('-3')).toBeNull();
  });
});

describe('detectarColumnas', () => {
  it('reconoce encabezados en español', () => {
    const mapeo = detectarColumnas(['Título', 'Precio', 'SKU', 'Existencias']);

    expect(mapeo.titulo).toBe(0);
    expect(mapeo.precio).toBe(1);
    expect(mapeo.sku).toBe(2);
    expect(mapeo.existencias).toBe(3);
  });

  it('reconoce encabezados en inglés, que es lo que sale de las extensiones', () => {
    const mapeo = detectarColumnas(['Product Title', 'Price', 'ASIN', 'Brand', 'Image URL']);

    expect(mapeo.titulo).toBe(0);
    expect(mapeo.precio).toBe(1);
    expect(mapeo.sku).toBe(2);
    expect(mapeo.marca).toBe(3);
    expect(mapeo.imagen).toBe(4);
  });

  it('no le importan los acentos ni las mayúsculas', () => {
    expect(detectarColumnas(['DESCRIPCIÓN']).descripcion).toBe(0);
    expect(detectarColumnas(['descripcion']).descripcion).toBe(0);
  });

  it('entiende guiones bajos y guiones', () => {
    const mapeo = detectarColumnas(['product_title', 'list-price']);
    expect(mapeo.titulo).toBe(0);
    expect(mapeo.precioComparar).toBe(1);
  });

  /**
   * El caso que de verdad necesita el control de columnas ya usadas, y que no es
   * el obvio.
   *
   * Con `Precio` y `Precio de lista` las dos coinciden exactas y no hace falta
   * guardia. El problema aparece con **una sola columna**: `precio` la coge por
   * coincidencia exacta, y después `precioComparar` la volvería a coger por
   * coincidencia parcial, porque su alias «precio comparar» contiene «precio».
   *
   * El resultado sería un catálogo entero con el mismo precio en los dos campos:
   * cada ficha con un descuento del cero por ciento tachándose a sí misma.
   */
  it('una sola columna de precio no se asigna también al precio anterior', () => {
    const mapeo = detectarColumnas(['Titulo', 'Precio']);

    expect(mapeo.precio).toBe(1);
    expect(mapeo.precioComparar).toBeUndefined();
  });

  it('con dos columnas de precio, cada una va a su campo', () => {
    const mapeo = detectarColumnas(['Precio', 'Precio de lista']);

    expect(mapeo.precio).toBe(0);
    expect(mapeo.precioComparar).toBe(1);
  });

  it('deja sin asignar lo que no reconoce', () => {
    const mapeo = detectarColumnas(['Título', 'Precio', 'Columna rara del proveedor']);
    expect(Object.values(mapeo)).not.toContain(2);
  });

  it('con encabezados vacíos no asigna nada', () => {
    expect(detectarColumnas(['', '  '])).toEqual({});
  });
});

describe('analizar', () => {
  const CABECERA = 'Titulo,Precio,SKU,Existencias';

  it('convierte filas en productos', () => {
    const { productos, rechazadas } = analizar(`${CABECERA}\nCamisa,19.90,CAM-1,5`);

    expect(rechazadas).toHaveLength(0);
    expect(productos).toHaveLength(1);
    expect(productos[0]).toMatchObject({
      titulo: 'Camisa',
      precio: 19.9,
      sku: 'CAM-1',
      existencias: 5,
      fila: 2,
    });
  });

  /**
   * Un fichero de mil productos con tres filas rotas tiene que importar
   * novecientos noventa y siete, no cero. Y decir cuáles fallaron y por qué.
   */
  it('las filas rotas no detienen a las buenas', () => {
    const { productos, rechazadas } = analizar(
      `${CABECERA}\nCamisa,19.90,A,5\n,25.00,B,1\nGorra,consultar,C,2\nBolso,30.00,D,3`,
    );

    expect(productos.map((p) => p.titulo)).toEqual(['Camisa', 'Bolso']);
    expect(rechazadas).toHaveLength(2);
    expect(rechazadas[0]).toMatchObject({ fila: 3, motivo: 'sin título' });
    expect(rechazadas[1]?.fila).toBe(4);
    expect(rechazadas[1]?.motivo).toMatch(/precio/);
  });

  // El número tiene que ser el que ve quien abre la hoja en Excel, no el índice
  // del array: si no coinciden, mandas a alguien a mirar la fila equivocada.
  it('el número de fila es el de la hoja de cálculo', () => {
    const { rechazadas } = analizar(`${CABECERA}\nA,1.00,,1\nB,1.00,,1\n,1.00,,1`);
    expect(rechazadas[0]?.fila).toBe(4);
  });

  it('avisa de códigos repetidos sin rechazar la fila', () => {
    const { productos } = analizar(`${CABECERA}\nCamisa,19.90,REP,5\nGorra,9.90,REP,2`);

    expect(productos).toHaveLength(2);
    expect(productos[1]?.avisos[0]).toMatch(/REP.*fila 2/);
  });

  it('ignora un precio anterior que no sea mayor, y lo dice', () => {
    const texto = 'Titulo,Precio,Precio de lista\nCamisa,19.90,15.00';
    const { productos } = analizar(texto);

    expect(productos[0]?.precioComparar).toBeNull();
    expect(productos[0]?.avisos[0]).toMatch(/no es mayor/);
  });

  it('acepta un precio anterior mayor', () => {
    const texto = 'Titulo,Precio,Precio de lista\nCamisa,19.90,29.90';
    expect(analizar(texto).productos[0]?.precioComparar).toBe(29.9);
  });

  it('sin columna de existencias, deja todo en cero', () => {
    const { productos } = analizar('Titulo,Precio\nCamisa,19.90');
    expect(productos[0]?.existencias).toBe(0);
  });

  it('avisa si la cantidad no se entiende, y no rechaza la fila', () => {
    const { productos } = analizar(`${CABECERA}\nCamisa,19.90,A,muchas`);

    expect(productos).toHaveLength(1);
    expect(productos[0]?.existencias).toBe(0);
    expect(productos[0]?.avisos[0]).toMatch(/muchas/);
  });

  // Sin título o sin precio no hay producto que crear, y decirlo antes de
  // empezar es mejor que rechazar las mil filas una a una.
  it('avisa de los campos requeridos que faltan, y no analiza nada', () => {
    const { faltanCampos, productos } = analizar('Marca,Color\nNike,Rojo');

    expect(faltanCampos).toEqual(['titulo', 'precio']);
    expect(productos).toHaveLength(0);
  });

  it('acepta un mapeo corregido a mano', () => {
    // Encabezados que no reconocería solo: la corrección manda.
    const texto = 'Col A,Col B\nCamisa,19.90';
    const { productos, faltanCampos } = analizar(texto, { titulo: 0, precio: 1 });

    expect(faltanCampos).toHaveLength(0);
    expect(productos[0]).toMatchObject({ titulo: 'Camisa', precio: 19.9 });
  });

  it('funciona con un fichero de Excel en español, con punto y coma y comas decimales', () => {
    const texto = 'Titulo;Precio;Existencias\nCamisa de algodón;19,90;5\nGorra;9,50;12';
    const { productos, rechazadas } = analizar(texto);

    expect(rechazadas).toHaveLength(0);
    expect(productos.map((p) => p.precio)).toEqual([19.9, 9.5]);
  });

  it('funciona con lo que exporta una extensión de Amazon', () => {
    const texto = [
      'ASIN,Product Title,Price,Brand,Image URL',
      'B08XYZ,"Auriculares Bluetooth, 40h de batería, cancelación de ruido",$49.99,Sony,https://ejemplo.com/a.jpg',
    ].join('\n');

    const { productos, rechazadas } = analizar(texto);

    expect(rechazadas).toHaveLength(0);
    expect(productos[0]).toMatchObject({
      sku: 'B08XYZ',
      titulo: 'Auriculares Bluetooth, 40h de batería, cancelación de ruido',
      precio: 49.99,
      marca: 'Sony',
      imagen: 'https://ejemplo.com/a.jpg',
    });
  });

  it('un fichero vacío no da productos ni revienta', () => {
    const { productos, rechazadas } = analizar('');
    expect(productos).toHaveLength(0);
    expect(rechazadas).toHaveLength(0);
  });
});
