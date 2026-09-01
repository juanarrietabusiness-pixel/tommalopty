/**
 * Máquina de estados de un pedido.
 *
 * Sin esto, el panel permite cualquier transición: pasar un pedido "entregado"
 * de vuelta a "pendiente", o "reembolsado" a "enviado". A escala eso corrompe
 * los reportes de ventas y deja pedidos en estados que ningún proceso sabe
 * resolver. Las transiciones válidas se declaran aquí una sola vez.
 */

export type OrderStatus =
  'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';

export type PaymentStatus =
  | 'pending'
  | 'authorized'
  | 'partially_paid'
  | 'paid'
  | 'partially_refunded'
  | 'refunded'
  | 'failed'
  | 'cancelled';

const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled', 'refunded'],
  processing: ['shipped', 'cancelled', 'refunded'],
  shipped: ['delivered', 'refunded'],
  // Estados terminales: un pedido entregado solo puede reembolsarse.
  delivered: ['refunded'],
  cancelled: [],
  refunded: [],
};

const PAYMENT_TRANSITIONS: Record<PaymentStatus, readonly PaymentStatus[]> = {
  pending: ['authorized', 'partially_paid', 'paid', 'failed', 'cancelled'],
  authorized: ['partially_paid', 'paid', 'failed', 'cancelled'],
  // Los abonos: se cobra por partes hasta cerrar el saldo. Puede volver a
  // `pending` porque un abono mal registrado se corrige borrándolo, y entonces
  // el pedido vuelve a no tener nada cobrado.
  partially_paid: ['paid', 'pending', 'failed', 'cancelled'],
  paid: ['partially_refunded', 'refunded'],
  partially_refunded: ['refunded'],
  refunded: [],
  // Un intento fallido no se "arregla": se reintenta y genera un pago nuevo.
  failed: ['pending'],
  cancelled: [],
};

export function canTransitionOrder(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) return true;
  return ORDER_TRANSITIONS[from].includes(to);
}

export function canTransitionPayment(from: PaymentStatus, to: PaymentStatus): boolean {
  if (from === to) return true;
  return PAYMENT_TRANSITIONS[from].includes(to);
}

export function allowedOrderTransitions(from: OrderStatus): readonly OrderStatus[] {
  return ORDER_TRANSITIONS[from];
}

export function allowedPaymentTransitions(from: PaymentStatus): readonly PaymentStatus[] {
  return PAYMENT_TRANSITIONS[from];
}

export function isTerminalOrderStatus(status: OrderStatus): boolean {
  return ORDER_TRANSITIONS[status].length === 0;
}

/**
 * Un pedido solo cuenta como venta cuando el dinero entró. Es la regla que usan
 * los reportes: si cambia, cambia aquí y en las vistas SQL a la vez.
 *
 * Con abonos, un pedido parcialmente pagado también cuenta: hay dinero en la
 * caja. **Cuánto** cuenta lo deciden las vistas, que suman `amount_paid` y no
 * el total del pedido (migración 0028). Esta función solo dice si entra en el
 * reporte, no por cuánto.
 */
export function countsAsRevenue(paymentStatus: PaymentStatus): boolean {
  return (
    paymentStatus === 'paid' ||
    paymentStatus === 'partially_paid' ||
    paymentStatus === 'partially_refunded'
  );
}

export interface TransitionError {
  field: 'status' | 'payment_status';
  from: string;
  to: string;
  message: string;
}

/** Valida un cambio de estado antes de tocar la base de datos. */
export function validateOrderTransition(input: {
  currentStatus: OrderStatus;
  nextStatus: OrderStatus;
  currentPaymentStatus: PaymentStatus;
  nextPaymentStatus: PaymentStatus;
}): TransitionError[] {
  const errors: TransitionError[] = [];

  if (!canTransitionOrder(input.currentStatus, input.nextStatus)) {
    errors.push({
      field: 'status',
      from: input.currentStatus,
      to: input.nextStatus,
      message: `Un pedido "${input.currentStatus}" no puede pasar a "${input.nextStatus}".`,
    });
  }

  if (!canTransitionPayment(input.currentPaymentStatus, input.nextPaymentStatus)) {
    errors.push({
      field: 'payment_status',
      from: input.currentPaymentStatus,
      to: input.nextPaymentStatus,
      message: `Un pago "${input.currentPaymentStatus}" no puede pasar a "${input.nextPaymentStatus}".`,
    });
  }

  return errors;
}
