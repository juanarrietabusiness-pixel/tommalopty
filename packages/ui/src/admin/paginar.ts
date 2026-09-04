/**
 * Las cuentas de la paginación, separadas del componente que las pinta.
 *
 * Van en su propio fichero —y no dentro de `paginacion.tsx`— para que se puedan
 * probar sin arrastrar React ni `next/link`. Son la parte donde un error se
 * nota: una cuenta mal hecha esconde filas, y esconder filas sin decirlo es
 * exactamente el fallo que la paginación venía a arreglar.
 */

/** Cómo se reparte un total en páginas. Lo usan la consulta y el pie del listado. */
export interface Paginado {
  pagina: number;
  porPagina: number;
  offset: number;
  totalPaginas: number;
  /** Índice humano —desde 1— de la primera fila que se enseña. 0 si no hay ninguna. */
  desde: number;
  /** Índice humano de la última. */
  hasta: number;
}

/**
 * El número de página que llega por querystring, reducido a algo usable.
 *
 * Viene de fuera, así que se valida en vez de castearse: `?pagina=-3`,
 * `?pagina=abc`, `?pagina=2.5` y `?pagina=1e999` caen todos en la 1, que es la
 * respuesta correcta a un parámetro que no significa nada.
 */
export function parsePagina(value: string | undefined): number {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 1) return 1;
  return n;
}

/**
 * Resuelve la página pedida contra el total real.
 *
 * Sujeta la página al rango que existe a propósito: pedir la 900 de una lista
 * de tres devuelve la 3, no una tabla vacía. Quien llama compara lo pedido con
 * lo devuelto para saber si hay que corregir la dirección.
 */
export function paginar(total: number, paginaPedida: number, porPagina: number): Paginado {
  const tamano = Math.max(1, Math.floor(porPagina));
  const totalPaginas = Math.max(1, Math.ceil(total / tamano));
  const pagina = Math.min(Math.max(paginaPedida, 1), totalPaginas);
  const offset = (pagina - 1) * tamano;

  return {
    pagina,
    porPagina: tamano,
    offset,
    totalPaginas,
    desde: total === 0 ? 0 : offset + 1,
    hasta: Math.min(offset + tamano, total),
  };
}
