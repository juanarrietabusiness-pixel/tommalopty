import { describe, expect, it } from 'vitest';
import { computeOrderTotals, lineTotal } from './pricing';
import { roundMoney, sumMoney } from './money';

describe('aritmética de dinero', () => {
  it('no arrastra el error de coma flotante', () => {
    expect(sumMoney([0.1, 0.2])).toBe(0.3);
    expect(roundMoney(29.98 * 3)).toBe(89.94);
  });

  it('suma un carrito largo sin desviarse', () => {
    const precios = Array.from({ length: 100 }, () => 0.07);
    expect(sumMoney(precios)).toBe(7);
  });
});

describe('totales del pedido', () => {
  const lineas = [
    { unitPrice: 29.98, quantity: 2 },
    { unitPrice: 23.8, quantity: 1 },
  ];

  it('calcula el subtotal a partir de los precios del catálogo', () => {
    expect(lineTotal(lineas[0]!)).toBe(59.96);
    expect(computeOrderTotals({ lines: lineas }).subtotal).toBe(83.76);
  });

  it('aplica el descuento sobre el subtotal', () => {
    const totales = computeOrderTotals({
      lines: lineas,
      discount: { type: 'percentage', amount: 8.38 },
    });

    expect(totales.discountTotal).toBe(8.38);
    expect(totales.total).toBe(75.38);
  });

  it('nunca deja que el descuento supere el subtotal', () => {
    const totales = computeOrderTotals({
      lines: [{ unitPrice: 10, quantity: 1 }],
      discount: { type: 'fixed_amount', amount: 999 },
    });

    expect(totales.discountTotal).toBe(10);
    expect(totales.total).toBe(0);
  });

  it('ignora un descuento negativo en lugar de sumarlo al total', () => {
    const totales = computeOrderTotals({
      lines: [{ unitPrice: 10, quantity: 1 }],
      discount: { type: 'fixed_amount', amount: -50 },
    });

    expect(totales.discountTotal).toBe(0);
    expect(totales.total).toBe(10);
  });

  it('cobra el envío cuando no se alcanza el umbral', () => {
    const totales = computeOrderTotals({
      lines: [{ unitPrice: 20, quantity: 1 }],
      shipping: { price: 5, freeAboveSubtotal: 50 },
    });

    expect(totales.shippingTotal).toBe(5);
    expect(totales.total).toBe(25);
  });

  it('regala el envío al superar el umbral', () => {
    const totales = computeOrderTotals({
      lines: [{ unitPrice: 60, quantity: 1 }],
      shipping: { price: 5, freeAboveSubtotal: 50 },
    });

    expect(totales.shippingTotal).toBe(0);
    expect(totales.total).toBe(60);
  });

  it('evalúa el umbral de envío gratis DESPUÉS del descuento', () => {
    // 60 - 15 = 45, por debajo del umbral de 50: el envío se cobra.
    // Si se evaluara antes del descuento, regalaríamos un envío no ganado.
    const totales = computeOrderTotals({
      lines: [{ unitPrice: 60, quantity: 1 }],
      discount: { type: 'fixed_amount', amount: 15 },
      shipping: { price: 5, freeAboveSubtotal: 50 },
    });

    expect(totales.shippingTotal).toBe(5);
    expect(totales.total).toBe(50);
  });

  it('un cupón de envío gratis lo regala aunque no se alcance el umbral', () => {
    const totales = computeOrderTotals({
      lines: [{ unitPrice: 20, quantity: 1 }],
      discount: { type: 'free_shipping', amount: 0 },
      shipping: { price: 5, freeAboveSubtotal: 50 },
    });

    expect(totales.shippingTotal).toBe(0);
    expect(totales.total).toBe(20);
  });

  it('aplica impuestos sobre el subtotal ya descontado', () => {
    const totales = computeOrderTotals({
      lines: [{ unitPrice: 100, quantity: 1 }],
      discount: { type: 'percentage', amount: 10 },
      taxRate: 0.07,
    });

    expect(totales.taxTotal).toBe(6.3);
    expect(totales.total).toBe(96.3);
  });

  it('un carrito vacío da cero, no NaN', () => {
    expect(computeOrderTotals({ lines: [] })).toEqual({
      subtotal: 0,
      discountTotal: 0,
      shippingTotal: 0,
      taxTotal: 0,
      total: 0,
    });
  });

  it('el total nunca es negativo', () => {
    const totales = computeOrderTotals({
      lines: [{ unitPrice: 5, quantity: 1 }],
      discount: { type: 'fixed_amount', amount: 100 },
      shipping: { price: 0, freeAboveSubtotal: null },
    });

    expect(totales.total).toBeGreaterThanOrEqual(0);
  });
});
