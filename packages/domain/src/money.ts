/**
 * Aritmética de dinero.
 *
 * Los importes se manejan en dólares como `number` porque Postgres devuelve
 * `numeric` así, pero toda operación pasa por aquí para redondear a centavos en
 * cada paso. Sin esto, `0.1 + 0.2` acaba facturando 0.30000000000000004 y las
 * sumas de un carrito largo se desvían del total real.
 */

/** Redondea a centavos, evitando el sesgo de coma flotante de `Math.round`. */
export function toCents(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

/** Redondea un importe a 2 decimales. Usar tras cada operación. */
export function roundMoney(amount: number): number {
  return fromCents(toCents(amount));
}

export function multiplyMoney(amount: number, quantity: number): number {
  return fromCents(toCents(amount) * quantity);
}

export function sumMoney(amounts: number[]): number {
  return fromCents(amounts.reduce((total, amount) => total + toCents(amount), 0));
}
