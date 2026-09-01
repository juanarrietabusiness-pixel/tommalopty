'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { parsePolygon } from '@nebula/domain';
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

/* --- Zonas de reparto ------------------------------------------------------ */

/**
 * El polígono llega como texto JSON desde un campo oculto que rellena el mapa.
 *
 * Se valida dos veces a propósito: `z.string()` comprueba que sea JSON, y
 * `parsePolygon` —la misma función que usa la tienda para leerlo— comprueba que
 * sea un anillo utilizable. Guardar un polígono que la tienda no sabrá leer es
 * peor que rechazarlo: no falla al guardar, falla al repartir.
 */
const zonaSchema = z.object({
  name: z.string().trim().min(2, 'Ponle un nombre a la zona'),
  description: z.string().trim().max(300).optional(),
  polygon: z.string(),
  shippingPrice: z
    .string()
    .trim()
    .optional()
    .transform((valor) => (valor === '' || valor === undefined ? null : Number(valor)))
    .refine((valor) => valor === null || (Number.isFinite(valor) && valor >= 0), {
      message: 'La tarifa tiene que ser un número de cero para arriba.',
    }),
  handledBy: z.enum(['propio', 'courier']),
  isActive: z.boolean(),
  position: z.coerce.number().int().min(0).default(0),
});

function leerFormulario(formData: FormData) {
  return zonaSchema.safeParse({
    name: formData.get('name'),
    description: formData.get('description') || undefined,
    polygon: String(formData.get('polygon') ?? '[]'),
    shippingPrice: String(formData.get('shippingPrice') ?? ''),
    handledBy: formData.get('handledBy') === 'courier' ? 'courier' : 'propio',
    isActive: formData.get('isActive') === 'on',
    position: formData.get('position') || 0,
  });
}

/** Convierte el texto del campo oculto en un anillo válido, o falla. */
function leerPoligono(texto: string): { anillo: [number, number][] } | ActionResult {
  let crudo: unknown;
  try {
    crudo = JSON.parse(texto);
  } catch {
    return failure('El área dibujada no se pudo leer. Vuelve a dibujarla.');
  }

  const anillo = parsePolygon(crudo);
  if (anillo.length < 3) {
    return failure('Marca al menos tres puntos en el mapa para cerrar el área.');
  }

  return { anillo: anillo.map(([lng, lat]) => [lng, lat]) };
}

export async function createDeliveryZone(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();

  const demo = bloqueadoEnDemostracion();
  if (demo) return demo;

  const parsed = leerFormulario(formData);
  if (!parsed.success) return fromZodError(parsed.error);

  const poligono = leerPoligono(parsed.data.polygon);
  if (!('anillo' in poligono)) return poligono;

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.from('delivery_zones').insert({
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    polygon: poligono.anillo,
    shipping_price: parsed.data.shippingPrice,
    handled_by: parsed.data.handledBy,
    is_active: parsed.data.isActive,
    position: parsed.data.position,
  });

  if (error) return fromDatabaseError(error);

  revalidatePath('/configuracion/zonas');
  return success('Zona creada.');
}

export async function updateDeliveryZone(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();

  const demo = bloqueadoEnDemostracion();
  if (demo) return demo;

  const id = String(formData.get('id') ?? '');
  if (!id) return failure('Falta saber qué zona se está editando.');

  const parsed = leerFormulario(formData);
  if (!parsed.success) return fromZodError(parsed.error);

  const poligono = leerPoligono(parsed.data.polygon);
  if (!('anillo' in poligono)) return poligono;

  const supabase = await getSupabaseServerClient();
  const problema = checkWrite(
    await supabase
      .from('delivery_zones')
      .update({
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        polygon: poligono.anillo,
        shipping_price: parsed.data.shippingPrice,
        handled_by: parsed.data.handledBy,
        is_active: parsed.data.isActive,
        position: parsed.data.position,
      })
      .eq('id', id)
      .select('id'),
  );

  if (problema) return problema;

  revalidatePath('/configuracion/zonas');
  return success('Zona actualizada.');
}

export async function deleteDeliveryZone(id: string): Promise<ActionResult> {
  await requireAdmin();

  const demo = bloqueadoEnDemostracion();
  if (demo) return demo;

  const supabase = await getSupabaseServerClient();
  const problema = checkWrite(
    await supabase.from('delivery_zones').delete().eq('id', id).select('id'),
  );

  if (problema) return problema;

  revalidatePath('/configuracion/zonas');
  return success('Zona eliminada.');
}
