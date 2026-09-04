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

/**
 * Cuántas filas por página en los listados paginados del panel.
 *
 * Las cuentas viven en `@nebula/ui/admin` —junto al componente que las pinta y
 * donde hay con qué probarlas—; aquí queda solo la política de esta aplicación.
 */
export const POR_PAGINA = 50;

export { paginar, parsePagina, type Paginado } from '@nebula/ui/admin';

/**
 * Qué poner cuando un listado sale vacío.
 *
 * Distingue «no hay nada» de «tu filtro no encontró nada», que es la diferencia
 * entre asustarse y entender. Filtrar por «reembolsado» sin ninguno decía
 * «Todavía no hay pedidos» en una tienda con mil vendidos.
 *
 * Y con filtros puestos lo que hace falta no es un mensaje de bienvenida sino
 * la salida: por eso quien llama recibe también la dirección sin filtrar.
 */
export function mensajeVacio(hayFiltros: boolean, sinFiltros: string): string {
  return hayFiltros
    ? 'Ningún resultado con estos filtros. Prueba a quitarlos o a buscar otra cosa.'
    : sinFiltros;
}
