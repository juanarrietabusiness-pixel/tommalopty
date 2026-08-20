import { describe, expect, it } from 'vitest';
import {
  canTransitionOrder,
  canTransitionPayment,
  countsAsRevenue,
  isTerminalOrderStatus,
  validateOrderTransition,
} from './order-state';

describe('estados del pedido', () => {
  it('permite el camino normal de una venta', () => {
    expect(canTransitionOrder('pending', 'confirmed')).toBe(true);
    expect(canTransitionOrder('confirmed', 'processing')).toBe(true);
    expect(canTransitionOrder('processing', 'shipped')).toBe(true);
    expect(canTransitionOrder('shipped', 'delivered')).toBe(true);
  });

  it('impide retroceder un pedido ya entregado', () => {
    expect(canTransitionOrder('delivered', 'pending')).toBe(false);
    expect(canTransitionOrder('delivered', 'processing')).toBe(false);
  });

  it('deja reembolsar un pedido entregado', () => {
    expect(canTransitionOrder('delivered', 'refunded')).toBe(true);
  });

  it('trata cancelado y reembolsado como terminales', () => {
    expect(isTerminalOrderStatus('cancelled')).toBe(true);
    expect(isTerminalOrderStatus('refunded')).toBe(true);
    expect(canTransitionOrder('cancelled', 'confirmed')).toBe(false);
  });

  it('no permite cancelar un pedido ya enviado', () => {
    expect(canTransitionOrder('shipped', 'cancelled')).toBe(false);
  });

  it('acepta guardar sin cambiar de estado', () => {
    expect(canTransitionOrder('processing', 'processing')).toBe(true);
  });
});

describe('estados del pago', () => {
  it('sigue el camino de autorización y cobro', () => {
    expect(canTransitionPayment('pending', 'authorized')).toBe(true);
    expect(canTransitionPayment('authorized', 'paid')).toBe(true);
  });

  it('impide despagar un cobro confirmado', () => {
    expect(canTransitionPayment('paid', 'pending')).toBe(false);
    expect(canTransitionPayment('paid', 'failed')).toBe(false);
  });

  it('permite reembolsar, total o parcialmente', () => {
    expect(canTransitionPayment('paid', 'partially_refunded')).toBe(true);
    expect(canTransitionPayment('partially_refunded', 'refunded')).toBe(true);
  });

  it('no revive un reembolso completo', () => {
    expect(canTransitionPayment('refunded', 'paid')).toBe(false);
  });

  it('cuenta como ingreso solo el dinero que entró', () => {
    expect(countsAsRevenue('paid')).toBe(true);
    expect(countsAsRevenue('partially_refunded')).toBe(true);
    expect(countsAsRevenue('pending')).toBe(false);
    expect(countsAsRevenue('refunded')).toBe(false);
    expect(countsAsRevenue('failed')).toBe(false);
  });
});

describe('validación conjunta', () => {
  it('acepta una transición coherente', () => {
    expect(
      validateOrderTransition({
        currentStatus: 'pending',
        nextStatus: 'confirmed',
        currentPaymentStatus: 'pending',
        nextPaymentStatus: 'paid',
      }),
    ).toEqual([]);
  });

  it('explica cada transición inválida por separado', () => {
    const errores = validateOrderTransition({
      currentStatus: 'delivered',
      nextStatus: 'pending',
      currentPaymentStatus: 'refunded',
      nextPaymentStatus: 'paid',
    });

    expect(errores).toHaveLength(2);
    expect(errores.map((e) => e.field)).toEqual(['status', 'payment_status']);
    expect(errores[0]?.message).toContain('delivered');
  });
});
