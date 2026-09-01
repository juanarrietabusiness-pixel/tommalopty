'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { storage } from '@nebula/integrations';
import { getSupabaseServerClient } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';
import { getBucketPrivado } from '@/lib/media-privada';
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

  const { data: creado, error } = await supabase
    .from('payments')
    .insert({
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
    })
    .select('id')
    .single();

  if (error) return fromDatabaseError(error);

  // El comprobante va después de crear el pago, y su fallo no deshace el abono.
  // El dinero entró: eso es el hecho. La captura de la transferencia lo
  // documenta, y se puede volver a adjuntar. Perder el registro del cobro
  // porque la foto pesaba de más sería la decisión al revés.
  const aviso = await adjuntarComprobante(supabase, creado.id, formData.get('comprobante'));

  revalidatePath(`/pedidos/${parsed.data.orderId}`);

  const nota = excede
    ? `Abono registrado. Ojo: supera el saldo pendiente, que era de ${saldo.toFixed(2)}.`
    : 'Abono registrado.';

  return success(aviso ? `${nota} ${aviso}` : nota);
}

/**
 * Guarda el comprobante de un abono en el bucket privado.
 *
 * POR QUÉ PRIVADO
 *
 * Suele ser la captura de una transferencia bancaria: nombres, saldos y a veces
 * el número de cuenta de quien paga. En el bucket público de las imágenes de
 * catálogo, cualquiera con la URL la vería para siempre.
 *
 * Lo que se guarda en la fila es la **clave** del objeto, que por sí sola no
 * sirve de nada: no hay dominio que la sirva. Para verlo hay que pedir el pago
 * por una ruta que comprueba permisos.
 *
 * Devuelve un aviso si algo falló, o `null` si fue bien o no había nada que
 * subir. Nunca lanza: el abono ya está registrado y no se deshace por esto.
 */
async function adjuntarComprobante(
  supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>,
  paymentId: string,
  fichero: FormDataEntryValue | null,
): Promise<string | null> {
  if (!(fichero instanceof File) || fichero.size === 0) return null;

  const bucket = getBucketPrivado();
  if (!bucket) {
    return 'El comprobante no se pudo guardar: no hay almacenamiento privado conectado.';
  }

  const buffer = await fichero.arrayBuffer();

  // Lo que decide qué es el fichero son sus bytes, no lo que declare el
  // navegador.
  const comprobado = storage.comprobarSubidaPrivada({
    declaredType: fichero.type,
    size: fichero.size,
    bytes: new Uint8Array(buffer),
  });

  if (!comprobado.ok) return `El comprobante no se adjuntó: ${comprobado.reason}`;

  const clave = storage.construirClavePrivada({
    tipo: 'abono',
    duenoId: paymentId,
    extension: comprobado.extension,
    id: crypto.randomUUID(),
  });

  try {
    await bucket.put(clave, buffer, {
      httpMetadata: { contentType: comprobado.type, cacheControl: 'private, no-store' },
    });
  } catch (error) {
    console.error('[abonos] no se pudo guardar el comprobante', error);
    return 'El comprobante no se pudo subir. Puedes adjuntarlo después.';
  }

  const { error } = await supabase
    .from('payments')
    .update({ receipt_key: clave })
    .eq('id', paymentId);

  if (error) {
    // El objeto está en el bucket pero la fila no lo sabe: se borra para no
    // dejar la captura de una transferencia sin nada que la referencie ni la
    // borre después.
    await bucket.delete(clave).catch(() => undefined);
    console.error('[abonos] no se pudo apuntar el comprobante', error);
    return 'El comprobante no se pudo asociar al abono.';
  }

  return null;
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

  // Se lee la clave del comprobante ANTES de borrar la fila: después ya no hay
  // de dónde sacarla, y el objeto se quedaría en el bucket para siempre sin nada
  // que lo referencie. Un fichero con datos bancarios que nadie sabe que existe
  // es exactamente lo que no queremos acumular.
  const { data: pago } = await supabase
    .from('payments')
    .select('receipt_key')
    .eq('id', paymentId)
    .maybeSingle();

  const problema = checkWrite(
    await supabase.from('payments').delete().eq('id', paymentId).select('id'),
  );

  if (problema) return problema;

  // Después de borrar la fila, no antes: si el borrado falla, el comprobante
  // tiene que seguir estando donde su abono espera encontrarlo.
  if (pago?.receipt_key) {
    const bucket = getBucketPrivado();
    await bucket?.delete(pago.receipt_key).catch((error: unknown) => {
      // No se convierte en un fallo de la acción: el abono ya no está, que era
      // lo que se pidió. Queda en el registro para poder limpiarlo a mano.
      console.error('[abonos] quedó un comprobante huérfano en el bucket', error);
    });
  }

  revalidatePath(`/pedidos/${orderId}`);
  return success('Abono eliminado. El saldo se recalculó solo.');
}
