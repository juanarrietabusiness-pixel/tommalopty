import type { PaymentAmount } from './types';

/**
 * ¿Lo que la pasarela dice haber cobrado es lo que vale el pedido?
 *
 * Vive en el paquete de integraciones y no en el handler de webhooks porque es
 * regla de pago, no de transporte: la misma comprobación hará falta al capturar
 * un pago y al conciliar un reembolso. Y aquí se puede probar sin levantar una
 * ruta.
 *
 * Devuelve el motivo del descuadre, o `null` si cuadra. Hoy ninguna pasarela
 * está implementada, así que no se ejecuta todavía — y ese es justamente el
 * momento de escribirlo: cuando llegue la primera integración habrá prisa, todo
 * lo demás funcionará, y este es el paso que se salta.
 */
export function descuadreDeImporte(
  cobrado: PaymentAmount | null,
  totalPedido: number | string,
  divisaPedido: string,
): string | null {
  if (!cobrado) {
    return 'La pasarela confirmó el pago sin informar del importe cobrado.';
  }

  if (cobrado.currency !== divisaPedido) {
    return `Divisa distinta: el pedido es en ${divisaPedido} y se cobró en ${cobrado.currency}.`;
  }

  const esperado = Number(totalPedido);

  if (!Number.isFinite(esperado) || !Number.isFinite(cobrado.value)) {
    return `Importe no comparable: el pedido son ${totalPedido} y se cobraron ${cobrado.value}.`;
  }

  // Medio céntimo de margen por el redondeo de coma flotante, no por tolerancia
  // comercial: cualquier diferencia real es mayor que eso. Un pago de menos es
  // tan descuadre como uno de más — cobrar de más también hay que devolverlo.
  if (Math.abs(cobrado.value - esperado) > 0.005) {
    return `Importe distinto: el pedido son ${esperado} y se cobraron ${cobrado.value}.`;
  }

  return null;
}
