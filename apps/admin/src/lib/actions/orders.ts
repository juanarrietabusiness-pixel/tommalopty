'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getSupabaseServerClient } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';
import { fromDatabaseError, fromZodError, success, type ActionResult } from './result';

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

  const { error } = await supabase
    .from('orders')
    .update({
      status: input.status,
      payment_status: input.paymentStatus,
      fulfillment_status: input.fulfillmentStatus,
      // Marcar como pagado fija la fecha de venta que usan los reportes.
      ...(input.paymentStatus === 'paid' ? { placed_at: new Date().toISOString() } : {}),
    })
    .eq('id', input.orderId);

  if (error) return fromDatabaseError(error);

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
