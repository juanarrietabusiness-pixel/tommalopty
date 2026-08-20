import { describe, expect, it } from 'vitest';
import { descuadreDeImporte } from './verificacion';

/**
 * La comprobación que separa "la pasarela dice que se pagó" de "se pagó lo que
 * costaba". Sin ella, un pago parcial o manipulado marca el pedido como pagado.
 */
describe('descuadre de importe en el webhook', () => {
  it('acepta el pago cuando el importe y la divisa coinciden', () => {
    expect(descuadreDeImporte({ value: 49.9, currency: 'USD' }, 49.9, 'USD')).toBeNull();
  });

  it('acepta el total que Postgres devuelve como cadena', () => {
    // `orders.total` es numeric(12,2): según el cliente puede llegar como
    // string. Compararlo sin convertir daría descuadre en cada pago.
    expect(descuadreDeImporte({ value: 49.9, currency: 'USD' }, '49.90', 'USD')).toBeNull();
  });

  it('rechaza un pago parcial', () => {
    expect(descuadreDeImporte({ value: 10, currency: 'USD' }, 49.9, 'USD')).toMatch(
      /Importe distinto/,
    );
  });

  it('rechaza un cobro de más: también hay que devolverlo', () => {
    expect(descuadreDeImporte({ value: 500, currency: 'USD' }, 49.9, 'USD')).toMatch(
      /Importe distinto/,
    );
  });

  it('rechaza una divisa distinta aunque el número coincida', () => {
    expect(descuadreDeImporte({ value: 49.9, currency: 'EUR' as 'USD' }, 49.9, 'USD')).toMatch(
      /Divisa distinta/,
    );
  });

  it('rechaza un evento que confirma el pago sin decir cuánto', () => {
    expect(descuadreDeImporte(null, 49.9, 'USD')).toMatch(/sin informar del importe/);
  });

  it('tolera el redondeo de coma flotante, no una diferencia real', () => {
    // 0.1 + 0.2 = 0.30000000000000004: un total calculado en JS no puede dar
    // descuadre por el último bit.
    expect(descuadreDeImporte({ value: 0.1 + 0.2, currency: 'USD' }, 0.3, 'USD')).toBeNull();
    // Un céntimo sí es una diferencia real.
    expect(descuadreDeImporte({ value: 49.91, currency: 'USD' }, 49.9, 'USD')).toMatch(
      /Importe distinto/,
    );
  });

  it('no se traga un total corrupto haciéndolo pasar por válido', () => {
    expect(descuadreDeImporte({ value: 49.9, currency: 'USD' }, 'no-es-un-numero', 'USD')).toMatch(
      /no comparable/,
    );
    expect(descuadreDeImporte({ value: Number.NaN, currency: 'USD' }, 49.9, 'USD')).toMatch(
      /no comparable/,
    );
  });
});
