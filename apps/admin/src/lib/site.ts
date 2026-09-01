/**
 * La URL pública de la tienda, vista desde el panel.
 *
 * Existe por lo mismo que su gemela en la tienda: `??` solo salta con
 * `undefined`, y una variable sin definir en el despliegue llega como cadena
 * vacía. Aquí no reventaba la compilación —solo producía enlaces «Ver en la
 * tienda» que apuntaban a ninguna parte— pero es el mismo error.
 */

const RESPALDO = 'http://localhost:3000';

export function storefrontUrl(): string {
  const valor = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!valor) return RESPALDO;

  try {
    return new URL(valor).origin;
  } catch {
    return RESPALDO;
  }
}
