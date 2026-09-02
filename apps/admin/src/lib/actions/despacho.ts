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
  success,
  type ActionResult,
} from './result';

/**
 * Asignar un envío desde la pantalla de despacho.
 *
 * POR QUÉ NO REUTILIZA `updateShipment`
 *
 * Aquella mueve el estado y de paso guarda quién lo lleva, desde la ficha de un
 * pedido. Esta hace lo contrario: asigna a alguien y **deja que el estado se
 * mueva solo** de `pendiente` a `asignado`, que es la transición que la máquina
 * de estados ya permite. Meter las dos en la misma función obligaría a que quien
 * despacha eligiera un estado en una pantalla donde lo único que quiere elegir
 * es una persona.
 *
 * QUITAR LA ASIGNACIÓN NO ES UN CASO RARO
 *
 * Es la mitad del trabajo real: a alguien se le dañó la moto, se equivocó quien
 * asignó, entró un pedido urgente. Por eso `motorizadoId` admite `null` y el
 * envío vuelve a `pendiente`, que es de donde salió.
 */

const asignacionSchema = z.object({
  shipmentId: z.uuid(),
  /** `profile_id` del motorizado. `null` para quitarle la asignación. */
  motorizadoId: z.uuid().nullable(),
});

export async function asignarEnvio(
  shipmentId: string,
  motorizadoId: string | null,
): Promise<ActionResult> {
  await requireAdmin();

  const demo = bloqueadoEnDemostracion();
  if (demo) return demo;

  const parsed = asignacionSchema.safeParse({ shipmentId, motorizadoId });
  if (!parsed.success) return failure('Esa asignación no es válida.');

  const supabase = await getSupabaseServerClient();

  const { data: envio, error: errorLectura } = await supabase
    .from('shipments')
    .select('id, status, tracking_number, order_id')
    .eq('id', parsed.data.shipmentId)
    .maybeSingle();

  if (errorLectura) return fromDatabaseError(errorLectura);
  if (!envio) return failure('Ese envío ya no existe.');

  // Solo se toca el estado en los dos extremos del recorrido. Si el envío ya va
  // recogido o en ruta, cambiar de motorizado no lo devuelve al almacén: el
  // paquete está donde está, y retroceder el estado sería mentir sobre dónde.
  const estadoNuevo =
    parsed.data.motorizadoId === null && envio.status === 'asignado'
      ? 'pendiente'
      : parsed.data.motorizadoId !== null && envio.status === 'pendiente'
        ? 'asignado'
        : undefined;

  const problema = checkWrite(
    await supabase
      .from('shipments')
      .update({
        assigned_to: parsed.data.motorizadoId,
        ...(estadoNuevo ? { status: estadoNuevo } : {}),
      })
      .eq('id', parsed.data.shipmentId)
      .select('id'),
  );

  if (problema) return problema;

  revalidatePath('/despacho');
  revalidatePath(`/pedidos/${envio.order_id}`);

  return success(
    parsed.data.motorizadoId === null
      ? `${envio.tracking_number} vuelve a la lista sin asignar.`
      : `${envio.tracking_number} asignado. Ya le aparece en su aplicación.`,
  );
}
