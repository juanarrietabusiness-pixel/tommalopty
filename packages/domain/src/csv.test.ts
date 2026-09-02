import { describe, expect, it } from 'vitest';
import { detectarDelimitador, leerCsv } from './csv';

describe('detectarDelimitador', () => {
  it('reconoce la coma', () => {
    expect(detectarDelimitador('a,b,c\n1,2,3')).toBe(',');
  });

  // Excel en español exporta con punto y coma, porque la coma es el decimal.
  // Leerlo con coma da una sola columna gigante y un error que despista.
  it('reconoce el punto y coma de Excel en español', () => {
    expect(detectarDelimitador('titulo;precio;sku\nCamisa;19,90;A1')).toBe(';');
  });

  it('reconoce el tabulador', () => {
    expect(detectarDelimitador('a\tb\tc')).toBe('\t');
  });

  // Un título con comas dentro no puede votar por la coma: si votara, un fichero
  // de punto y coma con títulos así se leería mal.
  it('no cuenta los delimitadores que están dentro de comillas', () => {
    const linea = '"Auriculares, 40h, ruido";precio;sku';
    expect(detectarDelimitador(linea)).toBe(';');
  });

  it('con una sola columna se queda con la coma', () => {
    expect(detectarDelimitador('titulo\nCamisa')).toBe(',');
  });
});

describe('leerCsv', () => {
  it('lee encabezados y filas', () => {
    const { encabezados, filas } = leerCsv('titulo,precio\nCamisa,19.90\nGorra,9.50');

    expect(encabezados).toEqual(['titulo', 'precio']);
    expect(filas).toEqual([
      ['Camisa', '19.90'],
      ['Gorra', '9.50'],
    ]);
  });

  /**
   * El caso que justifica todo este fichero. Con `split(',')` esta fila son
   * cinco columnas y el precio acaba donde va otra cosa.
   */
  it('un título con comas dentro sigue siendo una sola columna', () => {
    const { filas } = leerCsv(
      'titulo,precio\n"Auriculares Bluetooth, 40h de batería, cancelación de ruido",49.99',
    );

    expect(filas[0]).toEqual([
      'Auriculares Bluetooth, 40h de batería, cancelación de ruido',
      '49.99',
    ]);
  });

  it('aguanta saltos de línea dentro de un campo entrecomillado', () => {
    const { filas } = leerCsv('titulo,descripcion\nCamisa,"Algodón\n100% orgánico"');

    expect(filas).toHaveLength(1);
    expect(filas[0]?.[1]).toBe('Algodón\n100% orgánico');
  });

  it('unas comillas dobles dentro son una comilla literal', () => {
    const { filas } = leerCsv('titulo\n"Pantalla de 15"" pulgadas"');
    expect(filas[0]?.[0]).toBe('Pantalla de 15" pulgadas');
  });

  it('lee ficheros con fin de línea de Windows', () => {
    const { encabezados, filas } = leerCsv('titulo,precio\r\nCamisa,19.90\r\n');

    expect(encabezados).toEqual(['titulo', 'precio']);
    expect(filas).toEqual([['Camisa', '19.90']]);
  });

  // El BOM se pega al primer encabezado y lo vuelve irreconocible: `\uFEFFtitulo`
  // no coincide con `titulo`, así que la detección de columnas falla justo en la
  // primera.
  it('quita el BOM que pone Excel al guardar en UTF-8', () => {
    const { encabezados } = leerCsv('\uFEFFtitulo,precio\nCamisa,19.90');
    expect(encabezados[0]).toBe('titulo');
  });

  it('recorta los espacios de los encabezados', () => {
    const { encabezados } = leerCsv(' titulo , precio \nCamisa,19.90');
    expect(encabezados).toEqual(['titulo', 'precio']);
  });

  it('descarta las filas completamente vacías', () => {
    const { filas } = leerCsv('titulo,precio\nCamisa,19.90\n\n\nGorra,9.50\n');
    expect(filas).toHaveLength(2);
  });

  it('no descarta una fila que solo tiene el título', () => {
    const { filas } = leerCsv('titulo,precio\nCamisa,');
    expect(filas).toEqual([['Camisa', '']]);
  });

  it('lee el último campo aunque el fichero no acabe en salto de línea', () => {
    const { filas } = leerCsv('titulo,precio\nCamisa,19.90');
    expect(filas[0]?.[1]).toBe('19.90');
  });

  it('respeta el delimitador que se le pase, sin adivinar', () => {
    const { encabezados } = leerCsv('a;b,c', ';');
    expect(encabezados).toEqual(['a', 'b,c']);
  });

  // Nunca lanza: quien revisa la previsualización puede juzgar un fichero raro,
  // un error técnico en su cara no.
  it('con comillas sin cerrar no revienta', () => {
    expect(() => leerCsv('titulo,precio\n"sin cerrar,19.90')).not.toThrow();
  });

  it('un fichero vacío da encabezados y filas vacíos', () => {
    expect(leerCsv('')).toEqual({ encabezados: [], filas: [], delimitador: ',' });
  });

  it('un fichero con solo encabezados no da filas', () => {
    const { encabezados, filas } = leerCsv('titulo,precio');
    expect(encabezados).toEqual(['titulo', 'precio']);
    expect(filas).toEqual([]);
  });
});
