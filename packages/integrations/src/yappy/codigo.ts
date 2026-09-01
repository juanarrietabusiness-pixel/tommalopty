/**
 * El código con el que se abre sesión en Yappy.
 *
 * Es lo primero de toda la integración y lo único que no se puede consultar en
 * ningún sitio si sale mal: la API responde «YP-0006, error al procesar los
 * datos» tanto si la clave está mal como si la fecha no es la que Yappy espera.
 * Por eso vive aparte, es puro, y tiene sus tests con el ejemplo literal del
 * manual.
 *
 * LA RECETA, TAL COMO LA DICE EL MANUAL (§ «Generación del código para inicio
 * de sesión»)
 *
 *   1. Concatenar la API Key y la fecha de hoy en formato `YYYY-MM-DD`.
 *      Ejemplo del manual: `ABCDE-7645X` + `2025-01-01` = `ABCDE-7645X2025-01-01`.
 *   2. Hacer un HMAC-SHA256 de esa cadena usando la Secret Key como clave.
 *   3. Enviar el resultado en hexadecimal como `code`.
 *
 * QUÉ FECHA, Y POR QUÉ IMPORTA TANTO
 *
 * El manual dice «fecha actual» y no dice de quién. Yappy es un banco panameño
 * y sus comercios están en Panamá, así que la fecha es la de Panamá (UTC−5, sin
 * horario de verano). Esto no es un detalle: el servidor de esta tienda corre en
 * Cloudflare, en UTC, y entre las 19:00 y la medianoche de Panamá el día UTC ya
 * cambió. Usar la fecha del servidor haría que la sesión dejara de abrirse cada
 * tarde y volviera a funcionar sola por la mañana — el tipo de fallo que se
 * persigue durante semanas.
 *
 * Se usa Web Crypto y no `node:crypto` por lo mismo que en `meta/hash.ts`: este
 * código tiene que correr igual en Node, en un Worker de Cloudflare y en una
 * Edge Function.
 */

/** Panamá no cambia la hora en todo el año: UTC−5 siempre. */
const HUSO_PANAMA = 'America/Panama';

/**
 * La fecha de hoy en Panamá, en `YYYY-MM-DD`.
 *
 * `en-CA` porque su formato corto de fecha es exactamente ISO, y así no hay que
 * recomponer la cadena a mano a partir de trozos.
 */
export function fechaEnPanama(momento: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: HUSO_PANAMA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(momento);
}

/**
 * El `code` que espera `POST /v1/session/login`.
 *
 * `fecha` se puede pasar para poder probarlo con el ejemplo del manual; en
 * producción se deja fuera y se calcula la de Panamá.
 */
export async function codigoDeSesion(
  apiKey: string,
  secretKey: string,
  fecha: string = fechaEnPanama(),
): Promise<string> {
  const clave = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secretKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const firma = await crypto.subtle.sign('HMAC', clave, new TextEncoder().encode(apiKey + fecha));

  return Array.from(new Uint8Array(firma))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
