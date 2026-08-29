import { describe, expect, it } from 'vitest';
import {
  MAX_VARIANT_TITLE_LENGTH,
  findDuplicateSkus,
  normalizeSku,
  validateVariant,
  type VariantDraft,
} from './variant';

function draft(overrides: Partial<VariantDraft> = {}): VariantDraft {
  return { title: 'Talla M', sku: 'CAM-M', price: 25, compareAtPrice: null, ...overrides };
}

describe('normalizeSku', () => {
  it('limpia espacios', () => {
    expect(normalizeSku('  CAM-M  ')).toBe('CAM-M');
  });

  // La columna es única en toda la tabla, no por producto: con cadena vacía el
  // segundo producto sin SKU choca contra el primero.
  it('convierte el vacío en null, no en cadena vacía', () => {
    expect(normalizeSku('')).toBeNull();
    expect(normalizeSku('   ')).toBeNull();
  });
});

describe('validateVariant', () => {
  it('acepta una variante correcta', () => {
    expect(validateVariant(draft())).toEqual([]);
  });

  it('acepta sin SKU y sin precio tachado', () => {
    expect(validateVariant(draft({ sku: '', compareAtPrice: null }))).toEqual([]);
  });

  it('acepta precio cero', () => {
    // Un producto regalo o de muestra es legítimo; negativo no.
    expect(validateVariant(draft({ price: 0 }))).toEqual([]);
  });

  it('exige nombre', () => {
    expect(validateVariant(draft({ title: '' }))).toContainEqual(
      expect.objectContaining({ field: 'title' as const }),
    );
    expect(validateVariant(draft({ title: '   ' }))).toContainEqual(
      expect.objectContaining({ field: 'title' as const }),
    );
  });

  it('limita la longitud del nombre', () => {
    const largo = 'x'.repeat(MAX_VARIANT_TITLE_LENGTH + 1);
    expect(validateVariant(draft({ title: largo }))).toContainEqual(
      expect.objectContaining({ field: 'title' as const }),
    );
  });

  it('rechaza precio negativo', () => {
    expect(validateVariant(draft({ price: -1 }))).toContainEqual(
      expect.objectContaining({ field: 'price' as const }),
    );
  });

  it('rechaza precio no numérico', () => {
    expect(validateVariant(draft({ price: Number.NaN }))).toContainEqual(
      expect.objectContaining({ field: 'price' as const }),
    );
    expect(validateVariant(draft({ price: Number.POSITIVE_INFINITY }))).toContainEqual(
      expect.objectContaining({ field: 'price' as const }),
    );
  });

  // Un precio de 10.999 se redondearía al guardarse en numeric(10,2), y quien
  // lo escribió vería otro número al recargar.
  it('rechaza más de dos decimales', () => {
    expect(validateVariant(draft({ price: 10.999 }))).toContainEqual(
      expect.objectContaining({ field: 'price' as const }),
    );
    expect(validateVariant(draft({ price: 10.99 }))).toEqual([]);
    expect(validateVariant(draft({ price: 10.9 }))).toEqual([]);
  });

  it('no se confunde con la aritmética de coma flotante', () => {
    // 0.1 * 100 no da exactamente 10 en binario. Si la comprobación fuera
    // ingenua, este precio perfectamente válido se rechazaría.
    for (const price of [0.1, 0.29, 1.15, 8.07, 19.99, 1234.56]) {
      expect(validateVariant(draft({ price }))).toEqual([]);
    }
  });

  // Es la restricción product_variants_compare_at_gt_price de la base de datos.
  it('exige que el precio tachado no sea menor que el de venta', () => {
    expect(validateVariant(draft({ price: 25, compareAtPrice: 20 }))).toContainEqual(
      expect.objectContaining({ field: 'compareAtPrice' as const }),
    );
  });

  it('acepta el precio tachado igual o mayor', () => {
    expect(validateVariant(draft({ price: 25, compareAtPrice: 25 }))).toEqual([]);
    expect(validateVariant(draft({ price: 25, compareAtPrice: 30 }))).toEqual([]);
  });

  it('no compara contra un precio que ya es inválido', () => {
    // Con el precio roto, solo debe quejarse del precio: decir además que el
    // tachado «tiene que ser mayor» manda a arreglar el campo equivocado.
    const errors = validateVariant(draft({ price: Number.NaN, compareAtPrice: 10 }));
    expect(errors).toHaveLength(1);
    expect(errors[0]?.field).toBe('price');
  });

  it('acumula todos los problemas en una pasada', () => {
    const errors = validateVariant(draft({ title: '', price: -5 }));
    expect(errors.map((e) => e.field).sort()).toEqual(['price', 'title']);
  });
});

describe('findDuplicateSkus', () => {
  it('no encuentra nada cuando son distintos', () => {
    expect(findDuplicateSkus(['CAM-S', 'CAM-M', 'CAM-L'])).toEqual([]);
  });

  it('encuentra el repetido', () => {
    expect(findDuplicateSkus(['CAM-S', 'CAM-M', 'CAM-S'])).toEqual(['CAM-S']);
  });

  it('ignora los vacíos, que se guardan como null', () => {
    expect(findDuplicateSkus(['', '   ', ''])).toEqual([]);
  });

  it('compara sin distinguir mayúsculas ni espacios', () => {
    // Postgres sí los distingue, pero dos SKU que solo difieren en el caso son
    // un error humano, no dos referencias distintas.
    expect(findDuplicateSkus(['CAM-M', 'cam-m'])).toHaveLength(1);
    expect(findDuplicateSkus(['CAM-M', ' CAM-M '])).toHaveLength(1);
  });

  it('no repite el mismo SKU en la lista de repetidos', () => {
    expect(findDuplicateSkus(['A', 'A', 'A'])).toEqual(['A']);
  });
});
