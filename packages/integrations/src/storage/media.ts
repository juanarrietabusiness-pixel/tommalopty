/**
 * Reglas de las imágenes que se suben al almacenamiento.
 *
 * Todo lo de este archivo es puro: no toca red ni bindings, para que las
 * decisiones de seguridad se puedan probar sin levantar nada. Quien habla con
 * R2 es la aplicación; quien decide qué se acepta y con qué nombre se guarda,
 * este módulo.
 *
 * Por qué importa: un panel que acepta ficheros es una puerta abierta al
 * almacenamiento público de la tienda. Las tres decisiones que la cierran son
 * no fiarse del `Content-Type` que manda el navegador, no dejar que el nombre
 * del fichero llegue nunca a la clave del objeto, y no aceptar SVG.
 */

export type MediaKind = 'producto' | 'cms';

/** Carpeta dentro del bucket, por tipo de contenido. */
const MEDIA_PREFIXES: Record<MediaKind, string> = {
  producto: 'productos',
  cms: 'cms',
};

/**
 * Formatos aceptados, y la extensión con la que se guardan.
 *
 * **SVG no está y no debe estar.** Un SVG es un documento XML que admite
 * `<script>`, así que servirlo desde el dominio de la tienda es un XSS
 * almacenado. Si algún día hacen falta iconos vectoriales, se resuelve
 * sirviéndolos desde otro dominio, no añadiéndolo aquí.
 */
export const ACCEPTED_MEDIA = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
} as const;

export type AcceptedMediaType = keyof typeof ACCEPTED_MEDIA;

/** Lo que se pone en el `accept` del input, para que el diálogo ya filtre. */
export const MEDIA_ACCEPT_ATTRIBUTE = Object.keys(ACCEPTED_MEDIA).join(',');

export const MAX_MEDIA_BYTES = 5 * 1024 * 1024;

export function isAcceptedMediaType(value: string): value is AcceptedMediaType {
  return Object.prototype.hasOwnProperty.call(ACCEPTED_MEDIA, value);
}

export type MediaCheck =
  { ok: true; type: AcceptedMediaType; extension: string } | { ok: false; reason: string };

function tooBig(size: number): string {
  const mb = (size / (1024 * 1024)).toFixed(1);
  const limite = MAX_MEDIA_BYTES / (1024 * 1024);
  return `La imagen pesa ${mb} MB y el máximo son ${limite} MB.`;
}

/**
 * Comprueba tamaño y formato reales de un fichero antes de guardarlo.
 *
 * `declaredType` es lo que dice el navegador y no se cree por sí solo: se usa
 * solo para dar un mensaje de error entendible. Lo que decide es `bytes`, que
 * son los primeros bytes del fichero.
 */
export function checkMediaUpload(input: {
  declaredType: string;
  size: number;
  bytes: Uint8Array;
}): MediaCheck {
  if (input.size <= 0) {
    return { ok: false, reason: 'El archivo está vacío.' };
  }

  if (input.size > MAX_MEDIA_BYTES) {
    return { ok: false, reason: tooBig(input.size) };
  }

  const real = sniffImageType(input.bytes);

  if (!real) {
    // El mensaje habla del formato declarado porque es lo que la persona cree
    // haber subido; decirle "los bytes no cuadran" no le sirve de nada.
    const declarado = isAcceptedMediaType(input.declaredType)
      ? `El archivo dice ser ${input.declaredType} pero su contenido no lo es.`
      : 'Ese formato no se acepta.';

    return { ok: false, reason: `${declarado} Usa JPG, PNG, WebP o AVIF.` };
  }

  return { ok: true, type: real, extension: ACCEPTED_MEDIA[real] };
}

function matches(bytes: Uint8Array, offset: number, signature: readonly number[]): boolean {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((byte, i) => bytes[offset + i] === byte);
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  if (bytes.length < offset + length) return '';
  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}

/**
 * Deduce el formato leyendo los primeros bytes.
 *
 * El navegador manda el `Content-Type` que le da la gana, así que un ejecutable
 * renombrado a `.jpg` llega declarándose `image/jpeg`. Estas firmas son lo
 * único que no se puede falsear sin construir un fichero que de verdad sea una
 * imagen.
 *
 * Devuelve `null` si no reconoce ninguno de los formatos aceptados.
 */
export function sniffImageType(bytes: Uint8Array): AcceptedMediaType | null {
  if (matches(bytes, 0, [0xff, 0xd8, 0xff])) return 'image/jpeg';

  if (matches(bytes, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';

  // WebP y AVIF son contenedores: la marca va después de la cabecera.
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') return 'image/webp';

  if (ascii(bytes, 4, 4) === 'ftyp') {
    const brand = ascii(bytes, 8, 4);
    if (brand === 'avif' || brand === 'avis') return 'image/avif';
  }

  return null;
}

/**
 * Clave con la que se guarda el objeto en el bucket.
 *
 * El nombre original del fichero **no entra aquí**, ni siquiera saneado: es
 * texto que elige quien sube, y de él salen los `../`, las claves duplicadas y
 * las colisiones entre dos personas subiendo `foto.jpg` a la vez. La clave se
 * construye entera desde datos que controla el servidor.
 */
export function buildMediaKey(input: {
  kind: MediaKind;
  extension: string;
  id: string;
  now?: Date;
}): string {
  const now = input.now ?? new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');

  return `${MEDIA_PREFIXES[input.kind]}/${year}/${month}/${input.id}.${input.extension}`;
}

/**
 * URL pública de un objeto ya guardado.
 *
 * Devuelve `null` si no hay dominio configurado. Es deliberado: sin dominio la
 * imagen se guarda pero nadie puede verla, y eso hay que decirlo en vez de
 * componer una URL rota.
 */
export function publicMediaUrl(key: string, baseUrl: string | undefined): string | null {
  if (!baseUrl) return null;
  return `${baseUrl.replace(/\/+$/, '')}/${key}`;
}

/**
 * La inversa de `publicMediaUrl`: de la URL guardada a la clave del objeto.
 *
 * Hace falta porque `product_images` guarda **solo la URL**, no la clave. Sin
 * esto, borrar una imagen quita la fila de la base y deja el fichero en R2 para
 * siempre — que es exactamente la basura que se acumuló hasta ahora.
 *
 * Es una ruta de **borrado**, así que ante la duda devuelve `null` y no una
 * clave aproximada: dejar un huérfano se arregla con un barrido; borrar el
 * objeto equivocado, no. Las tres guardas, y el orden importa:
 *
 * 1. **El origen tiene que ser el configurado.** Una URL de otro dominio no es
 *    nuestra y no se toca.
 * 2. **Se descodifica antes de mirar si hay `..`**, porque `%2e%2e` es `..`
 *    después de descodificar y no antes.
 * 3. **La clave tiene que caer bajo un prefijo conocido** (`productos/`,
 *    `cms/`). Aunque el bucket ya acota qué se puede borrar, esto impide que
 *    una URL rara apunte a un objeto que no es una imagen de catálogo.
 *
 * Caso que **no** cubre a propósito: si el dominio público cambia, las URL
 * viejas dejan de coincidir y devuelven `null`. Es lo correcto —no vamos a
 * adivinar— y esos objetos los recoge el barrido de huérfanos.
 */
export function mediaKeyFromUrl(url: string, baseUrl: string | undefined): string | null {
  if (!baseUrl) return null;

  let objetivo: URL;
  let base: URL;

  try {
    objetivo = new URL(url);
    base = new URL(baseUrl);
  } catch {
    return null;
  }

  if (objetivo.origin !== base.origin) return null;

  // El dominio público puede apuntar a una subcarpeta del bucket, así que la
  // ruta de la base se descuenta antes de quedarse con la clave.
  const raiz = base.pathname.replace(/\/+$/, '');
  if (raiz && !objetivo.pathname.startsWith(`${raiz}/`)) return null;

  const bruta = objetivo.pathname.slice(raiz.length).replace(/^\/+/, '');
  if (!bruta) return null;

  let clave: string;
  try {
    clave = decodeURIComponent(bruta);
  } catch {
    return null;
  }

  if (clave.includes('..')) return null;

  const conocidos = Object.values(MEDIA_PREFIXES);
  if (!conocidos.some((prefijo) => clave.startsWith(`${prefijo}/`))) return null;

  return clave;
}
