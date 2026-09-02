import { leerCsv, type CsvLeido } from './csv';

/**
 * Importar productos desde una hoja de cálculo.
 *
 * Dos usos, y el diseño sirve a los dos porque el problema es el mismo:
 *
 * - La dueña sube su propio inventario desde Excel.
 * - Alguien exporta desde una extensión tipo «DS Amazon Quick View Extended».
 *
 * Ninguna de las dos produce las mismas columnas. La extensión saca `ASIN`,
 * `Product Title`, `Price`; la hoja de la dueña dirá `Producto`, `Precio`,
 * `Cantidad`. **Por eso el mapeo de columnas es la función, y no un detalle**:
 * cualquier cosa que asuma unos encabezados fijos solo sirve para el fichero con
 * el que se probó.
 */

/** Los campos que un producto puede recibir de una hoja. */
export const CAMPOS = [
  'titulo',
  'precio',
  'precioComparar',
  'sku',
  'existencias',
  'descripcion',
  'marca',
  'imagen',
] as const;

export type Campo = (typeof CAMPOS)[number];

export const CAMPOS_REQUERIDOS: readonly Campo[] = ['titulo', 'precio'];

/**
 * Cómo se llama cada campo por ahí fuera.
 *
 * Se comparan en minúsculas y sin acentos, así que `Descripción` y `descripcion`
 * son lo mismo. El orden importa: gana la primera que coincida, y por eso
 * `precio de lista` va antes que `precio` en su propio campo.
 */
const ALIAS: Record<Campo, readonly string[]> = {
  titulo: ['titulo', 'title', 'producto', 'product', 'product title', 'nombre', 'name', 'articulo'],
  precio: ['precio', 'price', 'precio venta', 'precio de venta', 'pvp', 'valor', 'costo', 'amount'],
  precioComparar: [
    'precio comparar',
    'precio anterior',
    'precio lista',
    'precio de lista',
    'list price',
    'compare at price',
    'was price',
    'msrp',
  ],
  sku: ['sku', 'codigo', 'code', 'referencia', 'ref', 'asin', 'upc', 'ean', 'mpn'],
  existencias: ['existencias', 'stock', 'cantidad', 'quantity', 'qty', 'inventario', 'available'],
  descripcion: ['descripcion', 'description', 'detalle', 'detalles', 'features'],
  marca: ['marca', 'brand', 'fabricante', 'manufacturer'],
  imagen: ['imagen', 'image', 'image url', 'foto', 'picture', 'img', 'image link'],
};

/** Minúsculas, sin acentos y sin puntuación: para comparar encabezados de verdad. */
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_\-.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export type Mapeo = Partial<Record<Campo, number>>;

/**
 * Adivina qué columna es cada campo.
 *
 * Es una propuesta, no una decisión: quien importa la ve y la corrige antes de
 * que se escriba nada. Adivinar mal y avisar cuesta un clic; adivinar mal en
 * silencio mete mil productos con el precio en el campo del stock.
 *
 * Cada columna se usa **una sola vez**. Sin eso, un fichero con `precio` y
 * `precio de lista` podría asignar la misma columna a los dos campos y el
 * descuento saldría del cero por ciento en todo el catálogo.
 */
export function detectarColumnas(encabezados: readonly string[]): Mapeo {
  const mapeo: Mapeo = {};
  const usadas = new Set<number>();

  // Primero las coincidencias exactas, y después las parciales: si se mezclan,
  // «precio de lista» se lleva la columna «precio» por ser más larga.
  for (const exacta of [true, false]) {
    for (const campo of CAMPOS) {
      if (mapeo[campo] !== undefined) continue;

      const alias = ALIAS[campo];

      const indice = encabezados.findIndex((encabezado, i) => {
        if (usadas.has(i)) return false;
        const normalizado = normalizar(encabezado);
        if (normalizado === '') return false;

        return exacta
          ? alias.includes(normalizado)
          : alias.some((a) => normalizado.includes(a) || a.includes(normalizado));
      });

      if (indice >= 0) {
        mapeo[campo] = indice;
        usadas.add(indice);
      }
    }
  }

  return mapeo;
}

export interface PrecioLeido {
  valor: number | null;
  /** Lo que se entendió, para poder enseñarlo antes de escribir nada. */
  interpretacion: string;
}

/**
 * Convierte «$1,299.00» en 1299.
 *
 * Esto es lo más peligroso de todo el fichero, porque **equivocarse aquí cambia
 * un precio por mil** y nadie lo nota hasta que alguien compra. Las reglas:
 *
 * - Si están el punto y la coma, **manda el último**: es el decimal. Sirve para
 *   `1,299.00` (inglés) y para `1.299,00` (español) sin preguntar el idioma.
 * - Con un solo separador y **dos dígitos detrás**, es decimal: `19,90` → 19.90.
 * - Con un solo separador y **exactamente tres dígitos detrás**, es de millares:
 *   `1,500` → 1500. Un precio con tres decimales no existe en una tienda.
 * - Cualquier otra cosa **no se adivina**: se devuelve `null` y la fila se marca.
 *
 * Y pase lo que pase se devuelve `interpretacion`, que es lo que de verdad
 * protege: quien importa ve «$1,299.00 → 1299.00» en la previsualización antes
 * de que se escriba una sola fila.
 */
export function leerPrecio(bruto: string): PrecioLeido {
  const texto = bruto.trim();
  if (texto === '') return { valor: null, interpretacion: 'vacío' };

  // Fuera símbolos de moneda, espacios y cualquier letra: «US$ 45.00», «45 USD».
  //
  // Y después, fuera los separadores que quedan pegados a los extremos. Esto no
  // es cosmético: **el símbolo del balboa es `B/.`, y lleva un punto dentro.**
  // Sin este paso, `B/. 12.50` se limpia a `.12.50`, que tiene dos puntos, y la
  // regla de millares lo convierte en 1250 — cien veces el precio, en la moneda
  // del país donde está la tienda. Lo encontró su propio test.
  const soloNumero = texto
    .replace(/[^\d.,-]/g, '')
    .replace(/^[.,]+/, '')
    .replace(/[.,]+$/, '');

  if (soloNumero === '' || soloNumero === '-') {
    return { valor: null, interpretacion: `no se entiende «${texto}»` };
  }

  const negativo = soloNumero.startsWith('-');
  const cuerpo = soloNumero.replace(/-/g, '');

  const ultimoPunto = cuerpo.lastIndexOf('.');
  const ultimaComa = cuerpo.lastIndexOf(',');

  let normalizado: string;

  if (ultimoPunto >= 0 && ultimaComa >= 0) {
    const decimal = ultimoPunto > ultimaComa ? '.' : ',';
    const millares = decimal === '.' ? ',' : '.';
    normalizado = cuerpo.split(millares).join('').replace(decimal, '.');
  } else if (ultimoPunto >= 0 || ultimaComa >= 0) {
    const separador = ultimoPunto >= 0 ? '.' : ',';
    const posicion = ultimoPunto >= 0 ? ultimoPunto : ultimaComa;
    const digitosDetras = cuerpo.length - posicion - 1;
    const hayMasDeUno = cuerpo.split(separador).length > 2;

    if (hayMasDeUno) {
      // `1.234.567` solo puede ser millares repetidos.
      normalizado = cuerpo.split(separador).join('');
    } else if (digitosDetras === 3) {
      normalizado = cuerpo.replace(separador, '');
    } else if (digitosDetras >= 1 && digitosDetras <= 2) {
      normalizado = cuerpo.replace(separador, '.');
    } else {
      return {
        valor: null,
        interpretacion: `ambiguo: «${texto}» puede ser decimal o millares`,
      };
    }
  } else {
    normalizado = cuerpo;
  }

  const valor = Number(normalizado);

  if (!Number.isFinite(valor)) {
    return { valor: null, interpretacion: `no se entiende «${texto}»` };
  }

  if (negativo || valor < 0) {
    return { valor: null, interpretacion: `negativo: «${texto}»` };
  }

  return { valor, interpretacion: `${texto} → ${valor.toFixed(2)}` };
}

/** Lee una cantidad entera. Los decimales se descartan: media camisa no existe. */
export function leerEntero(bruto: string): number | null {
  const texto = bruto.trim();
  if (texto === '') return null;

  const soloDigitos = texto.replace(/[^\d-]/g, '');
  if (soloDigitos === '' || soloDigitos === '-') return null;

  const valor = Number.parseInt(soloDigitos, 10);
  if (!Number.isFinite(valor) || valor < 0) return null;

  return valor;
}

export interface ProductoImportado {
  /** Número de fila en el fichero, contando el encabezado. Para poder señalarla. */
  fila: number;
  titulo: string;
  precio: number;
  precioComparar: number | null;
  sku: string | null;
  existencias: number;
  descripcion: string | null;
  marca: string | null;
  imagen: string | null;
  /** Qué se entendió del precio, para enseñarlo en la previsualización. */
  precioLeido: string;
  /** Cosas raras que no impiden importar la fila, pero conviene que se vean. */
  avisos: string[];
}

export interface FilaRechazada {
  fila: number;
  /** El título si se pudo leer; si no, lo primero que traiga la fila. */
  referencia: string;
  motivo: string;
}

export interface Analisis {
  productos: ProductoImportado[];
  rechazadas: FilaRechazada[];
  encabezados: string[];
  mapeo: Mapeo;
  delimitador: string;
  /** Campos requeridos que ninguna columna cubre. Bloquea la importación. */
  faltanCampos: Campo[];
}

function celda(fila: readonly string[], indice: number | undefined): string {
  if (indice === undefined) return '';
  return (fila[indice] ?? '').trim();
}

/**
 * Analiza el fichero entero y devuelve qué entraría y qué no.
 *
 * **No escribe nada.** Existe para pintar una previsualización, y esa
 * previsualización es el único momento en que un humano puede ver que la columna
 * de precio era la de peso antes de que sea tarde.
 *
 * Las filas malas no detienen a las buenas: se apartan con su número de fila y
 * su motivo. Un fichero de mil productos con tres filas rotas debe importar
 * novecientos noventa y siete, no cero.
 */
export function analizar(texto: string, mapeoManual?: Mapeo): Analisis {
  const leido: CsvLeido = leerCsv(texto);
  const mapeo = mapeoManual ?? detectarColumnas(leido.encabezados);

  const faltanCampos = CAMPOS_REQUERIDOS.filter((campo) => mapeo[campo] === undefined);

  const productos: ProductoImportado[] = [];
  const rechazadas: FilaRechazada[] = [];
  const skusVistos = new Map<string, number>();

  if (faltanCampos.length > 0) {
    return {
      productos,
      rechazadas,
      encabezados: leido.encabezados,
      mapeo,
      delimitador: leido.delimitador,
      faltanCampos,
    };
  }

  leido.filas.forEach((fila, indice) => {
    // +2: una por el encabezado y otra porque las hojas de cálculo empiezan en 1.
    const numeroDeFila = indice + 2;

    const titulo = celda(fila, mapeo.titulo);
    const primeraNoVacia = fila.find((c) => c.trim() !== '')?.trim() ?? '';

    if (titulo === '') {
      rechazadas.push({
        fila: numeroDeFila,
        referencia: primeraNoVacia,
        motivo: 'sin título',
      });
      return;
    }

    const precio = leerPrecio(celda(fila, mapeo.precio));

    if (precio.valor === null) {
      rechazadas.push({
        fila: numeroDeFila,
        referencia: titulo,
        motivo: `precio ${precio.interpretacion}`,
      });
      return;
    }

    const avisos: string[] = [];
    const sku = celda(fila, mapeo.sku) || null;

    if (sku) {
      const anterior = skusVistos.get(sku.toLowerCase());
      if (anterior !== undefined) {
        // No se rechaza: puede ser una variante que la hoja repite. Pero si nadie
        // lo dice, el segundo pisa al primero sin dejar rastro.
        avisos.push(`el código «${sku}» ya salió en la fila ${anterior}`);
      } else {
        skusVistos.set(sku.toLowerCase(), numeroDeFila);
      }
    }

    const comparar = leerPrecio(celda(fila, mapeo.precioComparar));

    if (comparar.valor !== null && comparar.valor <= precio.valor) {
      // Un «precio antes» menor que el de ahora dibuja un descuento negativo en
      // la ficha. Se descarta el dato, no la fila.
      avisos.push('el precio anterior no es mayor que el actual: se ignora');
    }

    const existencias = leerEntero(celda(fila, mapeo.existencias));

    if (
      mapeo.existencias !== undefined &&
      existencias === null &&
      celda(fila, mapeo.existencias) !== ''
    ) {
      avisos.push(`no se entiende la cantidad «${celda(fila, mapeo.existencias)}»: se deja en 0`);
    }

    productos.push({
      fila: numeroDeFila,
      titulo,
      precio: precio.valor,
      precioComparar:
        comparar.valor !== null && comparar.valor > precio.valor ? comparar.valor : null,
      sku,
      existencias: existencias ?? 0,
      descripcion: celda(fila, mapeo.descripcion) || null,
      marca: celda(fila, mapeo.marca) || null,
      imagen: celda(fila, mapeo.imagen) || null,
      precioLeido: precio.interpretacion,
      avisos,
    });
  });

  return {
    productos,
    rechazadas,
    encabezados: leido.encabezados,
    mapeo,
    delimitador: leido.delimitador,
    faltanCampos: [],
  };
}
