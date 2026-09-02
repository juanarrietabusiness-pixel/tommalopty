/**
 * Cifrado de credenciales en reposo.
 *
 * El problema que resuelve: hasta ahora las claves de cada servicio vivían en
 * variables de entorno del hosting, así que ponerlas era «llamar al programador
 * y volver a desplegar». Quien lleva la tienda no puede hacer eso, y acaba
 * mandando su clave de Yappy por WhatsApp a quien sí puede.
 *
 * El modelo es el de n8n, y su compromiso es el mismo: **queda una variable de
 * entorno, una sola** —la clave maestra— y con ella se cifra todo lo demás, que
 * ya sí puede vivir en la base de datos y ponerse desde una pantalla.
 *
 * Guardar la clave maestra en la misma base que el texto cifrado no sería
 * cifrar: sería poner la llave encima del cofre. Por eso sigue siendo entorno, y
 * por eso no hay forma de quitar esa última variable.
 *
 * Se usa Web Crypto y no `node:crypto` a propósito: el panel corre sobre
 * Cloudflare Workers, donde Web Crypto es nativo, y en Node 22 también existe.
 * Una sola implementación para los dos sitios.
 */

/** Longitud exacta de la clave maestra, en bytes. AES-256 pide 32. */
const BYTES_DE_CLAVE = 32;

/**
 * 12 bytes es el tamaño de vector de inicialización que recomienda el propio
 * estándar para GCM: con otro tamaño, la implementación tiene que derivarlo y
 * se pierde parte de la garantía.
 */
const BYTES_DE_VECTOR = 12;

/** Prefijo de versión del sobre. Existe para poder rotar el algoritmo sin adivinar. */
const VERSION = 'v1';

export class ErrorDeCifrado extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'ErrorDeCifrado';
  }
}

function base64Desde(bytes: Uint8Array): string {
  let binario = '';
  for (const byte of bytes) binario += String.fromCharCode(byte);
  return btoa(binario);
}

function bytesDesdeBase64(texto: string): Uint8Array {
  const binario = atob(texto);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i += 1) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

/**
 * Convierte la clave maestra de texto a algo que Web Crypto pueda usar.
 *
 * Valida el tamaño **y falla**, en vez de rellenar o recortar. Una clave de
 * cuatro caracteres rellenada con ceros cifra igual de bien a ojos del código y
 * no protege nada; el fallo ruidoso es lo único que impide que eso llegue a
 * producción sin que nadie se entere.
 */
export async function importarClaveMaestra(claveEnBase64: string): Promise<CryptoKey> {
  let bytes: Uint8Array;

  try {
    bytes = bytesDesdeBase64(claveEnBase64.trim());
  } catch {
    throw new ErrorDeCifrado(
      'La clave maestra no es base64 válido. Genera una con `generarClaveMaestra()`.',
    );
  }

  if (bytes.length !== BYTES_DE_CLAVE) {
    throw new ErrorDeCifrado(
      `La clave maestra debe tener ${BYTES_DE_CLAVE} bytes (${bytes.length} recibidos). ` +
        'Genera una con `generarClaveMaestra()`.',
    );
  }

  return crypto.subtle.importKey('raw', bytes as BufferSource, 'AES-GCM', false, [
    'encrypt',
    'decrypt',
  ]);
}

/** Genera una clave maestra nueva, lista para pegar en la variable de entorno. */
export function generarClaveMaestra(): string {
  return base64Desde(crypto.getRandomValues(new Uint8Array(BYTES_DE_CLAVE)));
}

/**
 * Cifra un secreto y devuelve el sobre completo: `v1.<vector>.<cifrado>`.
 *
 * El vector va **dentro del sobre y en claro**, que es lo correcto: no es
 * secreto, tiene que ser distinto en cada cifrado, y quien descifra lo necesita.
 * Guardarlo aparte solo añade una forma de perderlo.
 */
export async function cifrar(textoPlano: string, clave: CryptoKey): Promise<string> {
  const vector = crypto.getRandomValues(new Uint8Array(BYTES_DE_VECTOR));

  const cifrado = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: vector as BufferSource },
    clave,
    new TextEncoder().encode(textoPlano),
  );

  return [VERSION, base64Desde(vector), base64Desde(new Uint8Array(cifrado))].join('.');
}

/**
 * Descifra un sobre. Lanza si está manipulado, truncado o si la clave no es la
 * que lo cifró — GCM autentica además de cifrar, así que un byte cambiado no
 * produce basura silenciosa, produce un error.
 */
export async function descifrar(sobre: string, clave: CryptoKey): Promise<string> {
  const [version, vectorEnBase64, cifradoEnBase64, ...sobra] = sobre.split('.');

  // Las tres partes tienen que estar **y no estar vacías**: `v1..abc` tiene tres
  // trozos y no sirve para nada, y sin esta comprobación llegaría hasta el
  // descifrado para fallar allí con un motivo que no dice qué pasó.
  if (!version || !vectorEnBase64 || !cifradoEnBase64 || sobra.length > 0) {
    throw new ErrorDeCifrado('El sobre cifrado no tiene la forma esperada.');
  }

  if (version !== VERSION) {
    throw new ErrorDeCifrado(`Versión de cifrado desconocida: ${version}.`);
  }

  try {
    const claro = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: bytesDesdeBase64(vectorEnBase64) as BufferSource },
      clave,
      bytesDesdeBase64(cifradoEnBase64) as BufferSource,
    );

    return new TextDecoder().decode(claro);
  } catch {
    // El motivo real no se propaga a propósito: distinguir «clave equivocada» de
    // «sobre manipulado» le dice a quien prueba a ciegas cuál de las dos cosas
    // acertó. Para quien opera de buena fe, las dos se arreglan igual.
    throw new ErrorDeCifrado(
      'No se pudo descifrar: la clave maestra no es la que cifró este valor, o el valor está dañado.',
    );
  }
}

/**
 * Cómo se enseña un secreto ya guardado. Nunca se devuelve el valor.
 *
 * Los últimos cuatro caracteres se dejan a la vista porque son los que permiten
 * responder «¿es esta la clave que puse?» sin volver a pedirla — el mismo truco
 * que usan las tarjetas. Pero solo si el secreto es lo bastante largo: enseñar
 * los cuatro últimos de algo que mide seis es enseñarlo casi entero.
 */
export function enmascarar(secreto: string): string {
  const MINIMO_PARA_ENSENAR_EL_FINAL = 12;
  const puntos = '••••••••';

  if (secreto.length < MINIMO_PARA_ENSENAR_EL_FINAL) return puntos;

  return `${puntos}${secreto.slice(-4)}`;
}
