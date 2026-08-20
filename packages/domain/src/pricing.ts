import { multiplyMoney, roundMoney, sumMoney } from './money';

/**
 * Cálculo de totales de un pedido.
 *
 * Función pura y sin dependencias: recibe los precios que ya se leyeron de la
 * base de datos y devuelve el desglose. Vive aquí, y no dentro del route
 * handler, para que las reglas de negocio se puedan probar sin levantar la
 * aplicación — y para que tienda y panel calculen exactamente igual.
 */

export type DiscountType = 'percentage' | 'fixed_amount' | 'free_shipping';

export interface PricedLine {
  /** Precio unitario tal y como está en el catálogo, no el que envía el cliente. */
  unitPrice: number;
  quantity: number;
}

export interface DiscountInput {
  type: DiscountType;
  /** Importe ya validado por la base de datos (`validate_discount`). */
  amount: number;
}

export interface ShippingInput {
  price: number;
  /** Umbral a partir del cual el envío es gratis. `null` = nunca. */
  freeAboveSubtotal: number | null;
}

export interface OrderTotals {
  subtotal: number;
  discountTotal: number;
  shippingTotal: number;
  taxTotal: number;
  total: number;
}

export interface ComputeTotalsInput {
  lines: PricedLine[];
  discount?: DiscountInput | null;
  shipping?: ShippingInput | null;
  /** Tipo impositivo en tanto por uno. Panamá: 0 por defecto. */
  taxRate?: number;
}

export function lineTotal(line: PricedLine): number {
  return multiplyMoney(line.unitPrice, line.quantity);
}

/**
 * Orden de aplicación, que importa y por eso se fija aquí:
 *   1. subtotal de líneas
 *   2. descuento sobre el subtotal (nunca puede dejarlo negativo)
 *   3. envío, evaluando el umbral de envío gratis sobre el subtotal YA
 *      descontado — si no, un cupón podría dejar el pedido por debajo del
 *      umbral y aun así regalar el envío
 *   4. impuestos sobre (subtotal − descuento)
 */
export function computeOrderTotals({
  lines,
  discount = null,
  shipping = null,
  taxRate = 0,
}: ComputeTotalsInput): OrderTotals {
  const subtotal = sumMoney(lines.map(lineTotal));

  const rawDiscount = discount ? Math.max(discount.amount, 0) : 0;
  // Un descuento nunca puede superar el subtotal ni generar saldo a favor.
  const discountTotal = roundMoney(Math.min(rawDiscount, subtotal));

  const discountedSubtotal = roundMoney(subtotal - discountTotal);

  let shippingTotal = 0;
  if (shipping) {
    const qualifiesForFree =
      discount?.type === 'free_shipping' ||
      (shipping.freeAboveSubtotal !== null && discountedSubtotal >= shipping.freeAboveSubtotal);
    shippingTotal = qualifiesForFree ? 0 : roundMoney(Math.max(shipping.price, 0));
  }

  const taxTotal = roundMoney(discountedSubtotal * Math.max(taxRate, 0));
  const total = roundMoney(discountedSubtotal + shippingTotal + taxTotal);

  return { subtotal, discountTotal, shippingTotal, taxTotal, total };
}
