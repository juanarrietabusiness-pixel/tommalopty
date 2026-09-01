import { checkMediaUpload, type MediaCheck } from './media';

/**
 * El bucket privado: lo que no puede vivir en una URL pública.
 *
 * POR QUÉ HACEN FALTA DOS BUCKETS Y NO UNO
 *
 * El bucket de imágenes de producto es **público**, y tiene que serlo: una foto
 * de catálogo la pide el navegador de cualquiera que abra la tienda, y servirla
 * por un Worker sería pagar CPU por cada miniatura.
 *
 * Aquí van cosas de otra naturaleza:
 *
 *  - **La foto de la prueba de entrega.** Es la puerta de casa de alguien, a
 *    veces con la persona en el encuadre. Con una URL pública, quien la
 *    adivinara o la recibiera reenviada la vería para siempre — y las claves de
 *    objeto acaban en registros, en historiales y en capturas de pantalla.
 *  - **El comprobante de un abono.** Suele ser la captura de una transferencia
 *    bancaria, con nombres, saldos y números de cuenta.
 *
 * LA DIFERENCIA REAL NO ES EL BUCKET: ES QUE LA CLAVE NUNCA SALE
 *
 * Un bucket «privado» del que se reparten enlaces firmados sigue siendo un
 * bucket del que se reparten enlaces. Aquí la clave del objeto **no aparece
 * nunca en una URL ni llega al navegador**: se guarda en la base de datos junto
 * al envío o al pago, y quien quiere ver el fichero pide el envío o el pago —no
 * el fichero— por una ruta que comprueba permisos y devuelve los bytes.
 *
 * Eso significa que quien decide es RLS, que es donde ya vive el resto de las
 * reglas, y no un `if` escrito a mano en la ruta que sirve ficheros.
 */

/** Qué se guarda aquí. Cada uno con su prefijo, para poder mirarlos por separado. */
export const CONTENIDO_PRIVADO = {
  entrega: 'entregas',
  abono: 'abonos',
} as const;

export type ContenidoPrivado = keyof typeof CONTENIDO_PRIVADO;

/**
 * La validación es la misma que la del bucket público, y a propósito.
 *
 * Se aceptan las mismas cuatro imágenes, se leen los bytes para saber qué son
 * de verdad, y se rechaza todo lo demás — SVG incluido, que es un documento XML
 * capaz de traer `<script>`. Que el fichero no vaya a servirse en una URL
 * pública no lo hace inofensivo: lo va a abrir alguien del equipo en su
 * navegador.
 *
 * El PDF **no** se acepta, aunque un comprobante bancario a veces lo sea. Un PDF
 * puede traer JavaScript y acciones de apertura, y aceptarlo obligaría a
 * servirlo con cabeceras que impidan que el navegador lo ejecute. Si algún día
 * hace falta, se añade con esa decisión tomada y no de rebote. Mientras tanto,
 * una captura de pantalla resuelve el caso.
 */
export function comprobarSubidaPrivada(input: {
  declaredType: string;
  size: number;
  bytes: Uint8Array;
}): MediaCheck {
  return checkMediaUpload(input);
}

/**
 * La clave con la que se guarda el objeto.
 *
 * Lleva el identificador de lo que documenta —el envío o el pago— además de uno
 * aleatorio. El del envío no es un secreto que proteja nada: es para que, cuando
 * alguien mire el bucket a mano dentro de un año buscando qué borrar, pueda
 * saber a qué pertenece cada fichero sin cruzarlo con la base de datos.
 *
 * El nombre original del fichero no entra, ni siquiera saneado: es texto que
 * elige quien sube, y de ahí salen los `../` y las colisiones.
 */
export function construirClavePrivada(input: {
  tipo: ContenidoPrivado;
  /** Identificador del envío o del pago al que pertenece. */
  duenoId: string;
  extension: string;
  id: string;
  now?: Date;
}): string {
  const now = input.now ?? new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');

  // El identificador del dueño se limpia aunque venga de la base: si algún día
  // llega de otro sitio, una clave con barras dentro escribiría fuera de su
  // carpeta.
  const dueno = input.duenoId.replace(/[^a-zA-Z0-9-]/g, '');

  return `${CONTENIDO_PRIVADO[input.tipo]}/${year}/${month}/${dueno}/${input.id}.${input.extension}`;
}

/**
 * Cabeceras con las que se devuelve un objeto privado.
 *
 * `private` y `no-store` porque entre el Worker y quien mira hay proxies,
 * antivirus corporativos y el propio caché del navegador, y una foto de la
 * puerta de un cliente no debe quedarse en ninguno de ellos.
 *
 * `Content-Disposition: inline` con nombre propio: se ve en el navegador sin
 * descargar, y si alguien la descarga no arrastra el nombre del fichero
 * original, que puede llevar el nombre de una persona.
 *
 * `X-Content-Type-Options: nosniff` para que el navegador respete el tipo que
 * decimos y no adivine otro a partir del contenido.
 */
export function cabecerasDeObjetoPrivado(input: {
  contentType: string;
  nombreVisible: string;
}): Record<string, string> {
  return {
    'Content-Type': input.contentType,
    'Cache-Control': 'private, no-store, max-age=0',
    'Content-Disposition': `inline; filename="${input.nombreVisible.replace(/[^a-zA-Z0-9._-]/g, '')}"`,
    'X-Content-Type-Options': 'nosniff',
    // Que no se cuele en un `<iframe>` de otro sitio.
    'X-Frame-Options': 'DENY',
  };
}
