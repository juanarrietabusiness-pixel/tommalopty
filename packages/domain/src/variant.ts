/**
 * Reglas de una variante de producto.
 *
 * Duplican a propósito tres restricciones que la base de datos ya impone
 * (`product_variants_compare_at_gt_price`, el índice único de variante por
 * defecto y el `check (price >= 0)`). No es desconfianza en Postgres: es que un
 * `23514` en la cara de quien está dando de alta una talla no le dice qué
 * arreglar. La base de datos sigue siendo la que manda; esto solo llega antes
 * con un mensaje que se entiende.
 */

export interface VariantDraft {
  title: string;
  sku: string;
  price: number;
  compareAtPrice: number | null;
}

export const MAX_VARIANT_TITLE_LENGTH = 80;
export const MAX_VARIANT_SKU_LENGTH = 60;

export type VariantField = 'title' | 'sku' | 'price' | 'compareAtPrice';

export interface VariantValidationError {
  field: VariantField;
  message: string;
}

/**
 * El SKU vacío se guarda como `null`, no como cadena vacía.
 *
 * La columna es única en TODA la tabla, no por producto: con cadena vacía, el
 * segundo producto sin SKU choca contra el primero y el panel dice «ya existe un
 * registro con ese identificador» sin que nadie haya escrito ninguno.
 */
export function normalizeSku(sku: string): string | null {
  const limpio = sku.trim();
  return limpio === '' ? null : limpio;
}

/** Un importe con más de dos decimales se redondearía al guardarse. */
function tieneCentimosEnteros(amount: number): boolean {
  return (
    Number.isInteger(Math.round(amount * 100)) &&
    Math.abs(amount * 100 - Math.round(amount * 100)) < 1e-9
  );
}

export function validateVariant(draft: VariantDraft): VariantValidationError[] {
  const errors: VariantValidationError[] = [];

  const title = draft.title.trim();

  if (title === '') {
    errors.push({
      field: 'title',
      message: 'Ponle un nombre a la variante (por ejemplo, «Talla M»).',
    });
  } else if (title.length > MAX_VARIANT_TITLE_LENGTH) {
    errors.push({
      field: 'title',
      message: `El nombre no puede pasar de ${MAX_VARIANT_TITLE_LENGTH} caracteres.`,
    });
  }

  const sku = normalizeSku(draft.sku);

  if (sku !== null && sku.length > MAX_VARIANT_SKU_LENGTH) {
    errors.push({
      field: 'sku',
      message: `El SKU no puede pasar de ${MAX_VARIANT_SKU_LENGTH} caracteres.`,
    });
  }

  if (!Number.isFinite(draft.price)) {
    errors.push({ field: 'price', message: 'El precio tiene que ser un número.' });
  } else if (draft.price < 0) {
    errors.push({ field: 'price', message: 'El precio no puede ser negativo.' });
  } else if (!tieneCentimosEnteros(draft.price)) {
    errors.push({ field: 'price', message: 'El precio no puede tener más de dos decimales.' });
  }

  const compare = draft.compareAtPrice;

  if (compare !== null) {
    if (!Number.isFinite(compare)) {
      errors.push({
        field: 'compareAtPrice',
        message: 'El precio tachado tiene que ser un número.',
      });
    } else if (compare < 0) {
      errors.push({ field: 'compareAtPrice', message: 'El precio tachado no puede ser negativo.' });
    } else if (!tieneCentimosEnteros(compare)) {
      errors.push({
        field: 'compareAtPrice',
        message: 'El precio tachado no puede tener más de dos decimales.',
      });
    } else if (Number.isFinite(draft.price) && compare < draft.price) {
      // Es la restricción `product_variants_compare_at_gt_price`. Un precio
      // tachado por debajo del real anuncia una subida como si fuera oferta.
      errors.push({
        field: 'compareAtPrice',
        message: 'El precio tachado tiene que ser mayor que el precio de venta, o quedar vacío.',
      });
    }
  }

  return errors;
}

/**
 * Busca SKU repetidos entre las variantes de un mismo producto.
 *
 * La base de datos ya lo impide, pero su índice es global: el error que
 * devuelve no distingue entre «lo repetiste dentro de este producto» y «existe
 * en otro producto del catálogo», que se arreglan de forma distinta.
 */
export function findDuplicateSkus(skus: readonly string[]): string[] {
  const vistos = new Set<string>();
  const repetidos = new Set<string>();

  for (const raw of skus) {
    const sku = normalizeSku(raw);
    if (sku === null) continue;

    const clave = sku.toLowerCase();
    if (vistos.has(clave)) repetidos.add(sku);
    vistos.add(clave);
  }

  return [...repetidos];
}
