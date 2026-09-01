/**
 * La URL pública de la tienda, siempre utilizable.
 *
 * Parece una tontería tener una función para esto, y no lo es: el patrón
 * `process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'` que había
 * repartido por media aplicación **no protege de nada**. `??` solo salta con
 * `undefined`, y una variable de GitHub Actions sin definir no llega como
 * `undefined`: llega como cadena vacía. Con eso, `new URL('')` revienta y tumbó
 * la compilación entera de la tienda en el primer despliegue a staging.
 *
 * La referencia a `process.env.NEXT_PUBLIC_SITE_URL` se escribe literal a
 * propósito: Next la sustituye por su valor en tiempo de compilación, y una
 * lectura dinámica —`process.env[nombre]`— no se sustituye y volvería siempre el
 * valor por defecto en el navegador.
 */

const RESPALDO = 'http://localhost:3000';

export function siteUrl(): string {
  const valor = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!valor) return RESPALDO;

  // Una URL mal escrita es tan mortal como una vacía, y se equivoca igual de
  // fácil: basta pegar el dominio sin `https://`.
  try {
    return new URL(valor).origin;
  } catch {
    return RESPALDO;
  }
}
