/**
 * Lectura de CSV.
 *
 * Existe en vez de un `split(',')` porque los ficheros reales de este caso de uso
 * lo rompen en la primera fila. Un título de Amazon es, literalmente:
 *
 *   "Auriculares Bluetooth, 40h de batería, cancelación de ruido"
 *
 * Con `split(',')` eso son tres columnas, el precio se coloca donde va la marca,
 * y el catálogo entra con la basura ya dentro. Después nadie sabe qué producto
 * estaba mal porque los mil están mal a la vez.
 *
 * Y no se usa una librería porque el formato que hay que aguantar es pequeño y
 * conocido —RFC 4180 más los delimitadores que usa Excel— y una dependencia más
 * en el paquete de dominio, que es el que no depende de nada, se paga cada vez
 * que alguien la actualiza.
 */

/** Los tres delimitadores que salen de verdad de una hoja de cálculo. */
const DELIMITADORES = [',', ';', '\t'] as const;

export type Delimitador = (typeof DELIMITADORES)[number];

export interface CsvLeido {
  encabezados: string[];
  filas: string[][];
  delimitador: Delimitador;
}

/**
 * Adivina con qué se separan las columnas.
 *
 * Importa más de lo que parece: **Excel en español exporta con punto y coma**,
 * no con coma, porque en español la coma es el separador decimal. Un fichero así
 * leído con coma da una sola columna gigante, y el mensaje de error natural
 * —«no encuentro la columna de precio»— manda a buscar en el sitio equivocado.
 *
 * Se decide contando en la primera línea **fuera de comillas**: un título con
 * comas dentro no puede votar por la coma.
 */
export function detectarDelimitador(texto: string): Delimitador {
  const primeraLinea = texto.split(/\r?\n/, 1)[0] ?? '';

  let mejor: Delimitador = ',';
  let masApariciones = 0;

  for (const candidato of DELIMITADORES) {
    let apariciones = 0;
    let entreComillas = false;

    for (let i = 0; i < primeraLinea.length; i += 1) {
      const caracter = primeraLinea[i];
      if (caracter === '"') entreComillas = !entreComillas;
      else if (caracter === candidato && !entreComillas) apariciones += 1;
    }

    if (apariciones > masApariciones) {
      masApariciones = apariciones;
      mejor = candidato;
    }
  }

  return mejor;
}

/**
 * Convierte el texto en filas y columnas.
 *
 * Sigue RFC 4180: las comillas protegen delimitadores y saltos de línea, y unas
 * comillas dobles dentro de un campo entrecomillado son una comilla literal.
 *
 * Nunca lanza. Un fichero mal formado —comillas sin cerrar— se lee lo mejor que
 * se puede y lo que salga raro lo verá quien revise la previsualización, que es
 * quien puede juzgarlo. Lanzar aquí le daría un error técnico en vez de sus
 * datos.
 */
export function leerCsv(texto: string, delimitador?: Delimitador): CsvLeido {
  // El BOM que pone Excel al guardar en UTF-8 se pega al primer encabezado y lo
  // vuelve irreconocible: `\uFEFFtitulo` no coincide con `titulo`.
  const limpio = texto.replace(/^\uFEFF/, '');
  const separador = delimitador ?? detectarDelimitador(limpio);

  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = '';
  let entreComillas = false;

  for (let i = 0; i < limpio.length; i += 1) {
    const caracter = limpio[i];

    if (entreComillas) {
      if (caracter === '"') {
        if (limpio[i + 1] === '"') {
          campo += '"';
          i += 1;
        } else {
          entreComillas = false;
        }
      } else {
        campo += caracter;
      }
      continue;
    }

    if (caracter === '"') {
      entreComillas = true;
    } else if (caracter === separador) {
      fila.push(campo);
      campo = '';
    } else if (caracter === '\n') {
      fila.push(campo);
      filas.push(fila);
      fila = [];
      campo = '';
    } else if (caracter === '\r') {
      // Fin de línea de Windows: el `\n` que viene detrás hace el trabajo.
      continue;
    } else {
      campo += caracter;
    }
  }

  // La última fila no termina en salto de línea si el fichero no acaba con uno.
  if (campo !== '' || fila.length > 0) {
    fila.push(campo);
    filas.push(fila);
  }

  const sinVacias = filas.filter((f) => f.some((c) => c.trim() !== ''));
  const [encabezados = [], ...resto] = sinVacias;

  return {
    encabezados: encabezados.map((e) => e.trim()),
    filas: resto,
    delimitador: separador,
  };
}
