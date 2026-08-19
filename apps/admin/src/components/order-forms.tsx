'use client';

import { useActionState } from 'react';
import { addOrderNote, updateOrderStatus } from '@/lib/actions/orders';
import { IDLE } from '@/lib/actions/result';
import { FormFeedback, SubmitButton } from './form';

export function OrderStatusForm({
  orderId,
  status,
  paymentStatus,
  fulfillmentStatus,
}: {
  orderId: string;
  status: string;
  paymentStatus: string;
  fulfillmentStatus: string;
}) {
  const [state, formAction] = useActionState(updateOrderStatus, IDLE);

  return (
    <form action={formAction}>
      <input type="hidden" name="orderId" value={orderId} />
      <FormFeedback state={state} />

      <div className="field">
        <label htmlFor="status">Estado del pedido</label>
        <select id="status" name="status" defaultValue={status}>
          <option value="pending">Pendiente</option>
          <option value="confirmed">Confirmado</option>
          <option value="processing">En preparación</option>
          <option value="shipped">Enviado</option>
          <option value="delivered">Entregado</option>
          <option value="cancelled">Cancelado</option>
          <option value="refunded">Reembolsado</option>
        </select>
      </div>

      <div className="field">
        <label htmlFor="paymentStatus">Estado del pago</label>
        <select id="paymentStatus" name="paymentStatus" defaultValue={paymentStatus}>
          <option value="pending">Pendiente</option>
          <option value="authorized">Autorizado</option>
          <option value="paid">Pagado</option>
          <option value="partially_refunded">Reembolso parcial</option>
          <option value="refunded">Reembolsado</option>
          <option value="failed">Fallido</option>
          <option value="cancelled">Cancelado</option>
        </select>
        <span className="field-hint">
          Lo normal es que lo actualice el webhook de la pasarela; cámbialo a mano solo para
          pagos fuera de línea.
        </span>
      </div>

      <div className="field">
        <label htmlFor="fulfillmentStatus">Preparación</label>
        <select id="fulfillmentStatus" name="fulfillmentStatus" defaultValue={fulfillmentStatus}>
          <option value="unfulfilled">Sin preparar</option>
          <option value="partial">Parcial</option>
          <option value="fulfilled">Preparado</option>
          <option value="returned">Devuelto</option>
        </select>
      </div>

      <SubmitButton>Actualizar pedido</SubmitButton>
    </form>
  );
}

export function OrderNoteForm({ orderId }: { orderId: string }) {
  const [state, formAction] = useActionState(addOrderNote, IDLE);

  return (
    <form action={formAction}>
      <input type="hidden" name="orderId" value={orderId} />
      <FormFeedback state={state} />

      <div className="field">
        <label htmlFor="note">Nota interna</label>
        <textarea id="note" name="note" placeholder="Visible solo para el equipo" required />
      </div>

      <SubmitButton className="btn btn-outline btn-sm">Añadir nota</SubmitButton>
    </form>
  );
}
