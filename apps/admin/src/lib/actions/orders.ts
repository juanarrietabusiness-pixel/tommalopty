'use server';

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { z } from 'zod';
import { validateOrderTransition } from '@nebula/domain';
import { email as emails } from '@nebula/integrations';
import { getSupabaseServerClient } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';
import {
  checkWrite,
  failure,
  fromDatabaseError,
  fromZodError,
  success,
  type ActionResult,
} from './result';

/**
 * Gestión de pedidos.
 * Cada cambio de estado queda registrado por el trigger `log_order_status_change`,
 * así que la bitácora del pedido no depende de que la interfaz lo recuerde.
 */
const statusSchema = z.object({
  orderId: z.uuid(),
  status: z.enum([
    'pending',
    'confirmed',
    'processing',
    'shipped',
    'delivered',
    'cancelled',
    'refunded',
  ]),
  paymentStatus: z.enum([
    'pending',
    'authorized',
    'paid',
    'partially_refunded',
    'refunded',
    'failed',
    'cancelled',
  ]),
  fulfillmentStatus: z.enum(['unfulfilled', 'partial', 'fulfilled', 'returned']),
});

export async function updateOrderStatus(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();

  const parsed = statusSchema.safeParse({
    orderId: formData.get('orderId'),
    status: formData.get('status'),
    paymentStatus: formData.get('paymentStatus'),
    fulfillmentStatus: formData.get('fulfillmentStatus'),
  });

  if (!parsed.success) return fromZodError(parsed.error);

  const input = parsed.data;
  const supabase = await getSupabaseServerClient();

  // Estado actual, para validar que la transición es legal antes de escribir.
  const { data: current } = await supabase
    .from('orders')
    .select('status, payment_status, order_number, email, shipping_address')
    .eq('id', input.orderId)
    .maybeSingle();

  if (!current) return failure('El pedido ya no existe.');

  const transitionErrors = validateOrderTransition({
    currentStatus: current.status,
    nextStatus: input.status,
    currentPaymentStatus: current.payment_status,
    nextPaymentStatus: input.paymentStatus,
  });

  if (transitionErrors.length > 0) {
    return failure(transitionErrors.map((error) => error.message).join(' '), {
      status: transitionErrors.filter((e) => e.field === 'status').map((e) => e.message),
      paymentStatus: transitionErrors
        .filter((e) => e.field === 'payment_status')
        .map((e) => e.message),
    });
  }

  const problema = checkWrite(
    await supabase
      .from('orders')
      .update({
        status: input.status,
        payment_status: input.paymentStatus,
        fulfillment_status: input.fulfillmentStatus,
        // Marcar como pagado fija la fecha de venta que usan los reportes.
        ...(input.paymentStatus === 'paid' ? { placed_at: new Date().toISOString() } : {}),
      })
      .eq('id', input.orderId)
      .select('id'),
  );

  if (problema) return problema;

  // Aviso de envío al cliente. Solo en la transición: volver a guardar la ficha
  // de un pedido que ya estaba enviado no puede reenviar el correo.
  if (input.status === 'shipped' && current.status !== 'shipped') {
    after(async () => {
      const { firstName, lastName } = emails.nombreDeDireccion(current.shipping_address);

      const resultado = await emails.enviarPedidoEnviado({
        orderNumber: current.order_number,
        email: current.email,
        firstName,
        lastName,
      });

      if (!resultado.sent && resultado.reason !== 'email_not_configured') {
        console.error(
          `[pedidos] No se pudo avisar del envío de ${current.order_number}:`,
          resultado.reason,
        );
      }
    });
  }

  revalidatePath('/pedidos');
  revalidatePath(`/pedidos/${input.orderId}`);
  return success('Pedido actualizado.');
}

const noteSchema = z.object({
  orderId: z.uuid(),
  note: z.string().min(1, 'La nota no puede estar vacía').max(2000),
});

export async function addOrderNote(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();

  const parsed = noteSchema.safeParse({
    orderId: formData.get('orderId'),
    note: formData.get('note'),
  });

  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.from('order_events').insert({
    order_id: parsed.data.orderId,
    type: 'note',
    message: parsed.data.note,
  });

  if (error) return fromDatabaseError(error);

  revalidatePath(`/pedidos/${parsed.data.orderId}`);
  return success('Nota añadida.');
}
