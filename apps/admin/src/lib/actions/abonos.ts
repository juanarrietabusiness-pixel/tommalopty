'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getSupabaseServerClient } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';
import {
  bloqueadoEnDemostracion,
  checkWrite,
  failure,
  fromDatabaseError,
  fromZodError,
  success,
  type ActionResult,
} from './result';

/**
 * Abonos: registrar dinero que entró por fuera de la pasarela.
 *
 * Es el caso que la clienta pidió: alguien paga un pedido de $300 en tres
 * partes, en efectivo o por transferencia. Cada abono es una fila en `payments`
 * con proveedor `manual`, que es justo para lo que ese proveedor existe.
 *
 * NO SE TOCA EL SALDO NI EL ESTADO DEL PEDIDO
 *
 * Ni aquí ni en ninguna pantalla. Se inserta el pago y el disparador de la
 * migración 0027 recalcula `amount_paid` y decide el estado. Si esta acción
 * también los escribiera, habría dos sitios calculando el mismo número — y el
 * día que discrepen, nadie sabría cuál creer.
 */

const abonoSchema = z.object({
  orderId: z.uuid(),
  amount: z
    .string()
    .trim()
    .min(1, 'Indica cuánto se abonó')
    .transform((valor) => Number(valor))
    .refine((valor) => Number.isFinite(valor) && valor > 0, {
      message: 'El abono tiene que ser mayor que cero.',
    }),
  provider: z.enum(['manual', 'paypal', 'wompi', 'paguelofacil', 'yappy']),
  reference: z.string().trim().max(120).optional(),
});

export async function registrarAbono(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();

  const demo = bloqueadoEnDemostracion();
  if (demo) return demo;

  const parsed = abonoSchema.safeParse({
    orderId: formData.get('orderId'),
    amount: String(formData.get('amount') ?? ''),
    provider: formData.get('provider') ?? 'manual',
    reference: formData.get('reference') || undefined,
  });

  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await getSupabaseServerClient();

  const { data: pedido } = await supabase
    .from('orders')
    .select('id, total, amount_paid')
    .eq('id', parsed.data.orderId)
    .maybeSingle();

  if (!pedido) return failure('Ese pedido ya no existe.');

  const saldo = Number(pedido.total) - Number(pedido.amount_paid);

  // Se avisa, no se prohíbe. Cobrar de más pasa —un redondeo, una propina, un
  // cliente que paga el envío aparte— y bloquearlo obligaría a registrar el
  // dinero mal para que cuadre, que es peor que registrarlo como es.
  const excede = parsed.data.amount > saldo + 0.005;

  const { error } = await supabase.from('payments').insert({
    order_id: parsed.data.orderId,
    provider: parsed.data.provider,
    status: 'paid',
    amount: parsed.data.amount,
    processed_at: new Date().toISOString(),
    // En `reference`, no en `provider_payment_id`: esa columna tiene índice
    // único por proveedor, para que la misma confirmación de una pasarela no
    // entre dos veces. Una referencia escrita a mano —«efectivo», el nombre de
    // quien cobró— se repite todos los días, y chocaba. Ver migración 0029.
    reference: parsed.data.reference || null,
  });

  if (error) return fromDatabaseError(error);

  revalidatePath(`/pedidos/${parsed.data.orderId}`);

  return success(
    excede
      ? `Abono registrado. Ojo: supera el saldo pendiente, que era de ${saldo.toFixed(2)}.`
      : 'Abono registrado.',
  );
}

/**
 * Borra un abono mal registrado.
 *
 * Borrar y no «anular» porque un abono que nunca existió no es un movimiento
 * contable: es un error de tecleo. El saldo se recalcula solo, porque el
 * disparador escucha también los borrados.
 */
export async function borrarAbono(paymentId: string, orderId: string): Promise<ActionResult> {
  await requireAdmin();

  const demo = bloqueadoEnDemostracion();
  if (demo) return demo;

  const supabase = await getSupabaseServerClient();

  const problema = checkWrite(
    await supabase.from('payments').delete().eq('id', paymentId).select('id'),
  );

  if (problema) return problema;

  revalidatePath(`/pedidos/${orderId}`);
  return success('Abono eliminado. El saldo se recalculó solo.');
}
