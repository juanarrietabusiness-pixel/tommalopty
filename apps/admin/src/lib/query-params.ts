/**
 * Los filtros llegan por querystring, así que son texto arbitrario.
 * Estos helpers los reducen a valores válidos del enum en lugar de castearlos:
 * un parámetro manipulado se ignora en vez de llegar a la consulta.
 */
export function parseEnumParam<const T extends readonly string[]>(
  value: string | undefined,
  allowed: T,
): T[number] | undefined {
  if (!value) return undefined;
  return (allowed as readonly string[]).includes(value) ? (value as T[number]) : undefined;
}

export const PRODUCT_STATUSES = ['draft', 'active', 'archived'] as const;

export const ORDER_STATUSES = [
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
] as const;

export const PAYMENT_STATUSES = [
  'pending',
  'authorized',
  'paid',
  'partially_refunded',
  'refunded',
  'failed',
  'cancelled',
] as const;
