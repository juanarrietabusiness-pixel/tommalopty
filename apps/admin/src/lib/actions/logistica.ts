'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import {
  POLITICAS_DE_DESPACHO,
  SHIPMENT_STATUSES,
  isShipmentStatus,
  parsePolygon,
  validateShipmentTransition,
} from '@nebula/domain';
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

/* --- Envíos ---------------------------------------------------------------- */

/**
 * Crea el envío de un pedido copiando su dirección.
 *
 * La dirección se **copia**, no se referencia. Si mañana el cliente corrige la
 * suya, este envío no puede cambiar de destino: quien lo lleva tiene un papel
 * impreso, y el sistema tiene que coincidir con ese papel.
 */
export async function createShipment(orderId: string): Promise<ActionResult> {
  await requireAdmin();

  const demo = bloqueadoEnDemostracion();
  if (demo) return demo;

  const supabase = await getSupabaseServerClient();

  const { data: pedido, error: errorPedido } = await supabase
    .from('orders')
    .select('id, shipping_address, phone')
    .eq('id', orderId)
    .maybeSingle();

  if (errorPedido) return fromDatabaseError(errorPedido);
  if (!pedido) return failure('Ese pedido ya no existe.');

  const direccion = (pedido.shipping_address ?? {}) as Record<string, unknown>;

  const lat = typeof direccion.latitude === 'number' ? direccion.latitude : null;
  const lng = typeof direccion.longitude === 'number' ? direccion.longitude : null;

  const { error } = await supabase.from('shipments').insert({
    order_id: pedido.id,
    // El teléfono del pedido se copia dentro del destino si la dirección no
    // traía uno: en la calle, no tener a quién llamar es lo que convierte un
    // «no encuentro la puerta» en una entrega fallida.
    destination: {
      ...direccion,
      phone: (direccion.phone as string | undefined) ?? pedido.phone ?? undefined,
    },
    latitude: lat,
    longitude: lng,
  });

  if (error) return fromDatabaseError(error);

  revalidatePath(`/pedidos/${orderId}`);

  return lat === null
    ? success(
        'Envío creado. Ojo: este pedido no trae punto en el mapa, así que el QR no podrá abrir Waze.',
      )
    : success('Envío creado.');
}

const cambioSchema = z.object({
  shipmentId: z.uuid(),
  status: z.enum(SHIPMENT_STATUSES),
  assignedTo: z.string().trim().optional(),
  carrier: z.string().trim().max(80).optional(),
  carrierTrackingNumber: z.string().trim().max(80).optional(),
  carrierTrackingUrl: z.string().trim().max(500).optional(),
});

/**
 * Mueve un envío de estado, y de paso guarda quién lo lleva.
 *
 * La transición se valida aquí para poder devolver un mensaje entendible, y
 * otra vez en el disparador de Postgres, que es el que de verdad no se puede
 * saltar. Ver la migración 0025.
 */
export async function updateShipment(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();

  const demo = bloqueadoEnDemostracion();
  if (demo) return demo;

  const parsed = cambioSchema.safeParse({
    shipmentId: formData.get('shipmentId'),
    status: formData.get('status'),
    assignedTo: formData.get('assignedTo') || undefined,
    carrier: formData.get('carrier') || undefined,
    carrierTrackingNumber: formData.get('carrierTrackingNumber') || undefined,
    carrierTrackingUrl: formData.get('carrierTrackingUrl') || undefined,
  });

  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await getSupabaseServerClient();

  const { data: envio } = await supabase
    .from('shipments')
    .select('id, order_id, status')
    .eq('id', parsed.data.shipmentId)
    .maybeSingle();

  if (!envio) return failure('Ese envío ya no existe.');

  const actual = isShipmentStatus(envio.status) ? envio.status : 'pendiente';
  const problema = validateShipmentTransition(actual, parsed.data.status);
  if (problema) return failure(problema.message);

  const cambio = checkWrite(
    await supabase
      .from('shipments')
      .update({
        status: parsed.data.status,
        assigned_to: parsed.data.assignedTo || null,
        carrier: parsed.data.carrier ?? null,
        carrier_tracking_number: parsed.data.carrierTrackingNumber ?? null,
        carrier_tracking_url: parsed.data.carrierTrackingUrl ?? null,
      })
      .eq('id', parsed.data.shipmentId)
      .select('id'),
  );

  if (cambio) return cambio;

  revalidatePath(`/pedidos/${envio.order_id}`);
  return success('Envío actualizado.');
}

/* --- La regla de despacho (D4) ---------------------------------------------- */

const reglaSchema = z.object({
  politica: z.enum(POLITICAS_DE_DESPACHO),
  umbralPorcentaje: z.coerce.number().int().min(0).max(100),
});

/**
 * Guarda cuándo se deja salir un pedido con saldo.
 *
 * Existe porque sin ella la regla era «configurable» solo de nombre: vivía en
 * `settings`, sí, pero cambiarla exigía que alguien ejecutara SQL a mano. Una
 * decisión de negocio que necesita un programador no es configurable; es código
 * con más pasos.
 *
 * Solo superadministrador, que es quien toca lo que puede costar dinero.
 */
export async function guardarReglaDeDespacho(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const sesion = await requireAdmin();
  if (sesion.role !== 'superadmin') {
    return failure('Solo un superadministrador puede cambiar la regla de despacho.');
  }

  const demo = bloqueadoEnDemostracion();
  if (demo) return demo;

  const parsed = reglaSchema.safeParse({
    politica: formData.get('politica'),
    umbralPorcentaje: formData.get('umbralPorcentaje') || 50,
  });

  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await getSupabaseServerClient();

  const problema = checkWrite(
    await supabase
      .from('settings')
      .update({
        value: {
          politica: parsed.data.politica,
          umbralPorcentaje: parsed.data.umbralPorcentaje,
        },
        updated_by: sesion.userId,
      })
      .eq('key', 'dispatch_policy')
      .select('key'),
  );

  if (problema) return problema;

  revalidatePath('/configuracion/zonas');

  return success(
    parsed.data.politica === 'estricta'
      ? 'Regla guardada: no saldrá ningún pedido con saldo pendiente.'
      : parsed.data.politica === 'umbral'
        ? `Regla guardada: los pedidos saldrán al alcanzar el ${parsed.data.umbralPorcentaje} % del total.`
        : 'Regla guardada: los pedidos saldrán con saldo, y se cobrará al entregar.',
  );
}
