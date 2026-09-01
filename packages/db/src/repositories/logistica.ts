import type { SupabaseClient } from '@supabase/supabase-js';
import {
  isShipmentStatus,
  parsePolygon,
  type Coordinates,
  type DeliveryZone,
  type ShipmentStatus,
} from '@nebula/domain';
import type { Database, Json } from '../generated/database.types';

type Client = SupabaseClient<Database>;

/**
 * Zonas de reparto.
 *
 * El polígono se guarda en una columna `jsonb`, así que lo que sale de la base
 * no es un polígono por mucho que el tipo lo insinúe: se pasa por `parsePolygon`,
 * que descarta entero cualquier anillo mal formado. Un anillo a medio leer es
 * peor que uno vacío —haría que una dirección de fuera pareciera cubierta— y
 * por eso no se intenta recuperar lo que se pueda.
 */
export async function listDeliveryZones(
  client: Client,
  options: { soloActivas?: boolean } = {},
): Promise<DeliveryZone[]> {
  let query = client
    .from('delivery_zones')
    .select('id, name, polygon, shipping_price, handled_by, is_active, position')
    .order('position');

  if (options.soloActivas !== false) query = query.eq('is_active', true);

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((zona) => ({
    id: zona.id,
    name: zona.name,
    polygon: parsePolygon(zona.polygon),
    shippingPrice: zona.shipping_price,
    handledBy: zona.handled_by === 'courier' ? 'courier' : 'propio',
  }));
}

/* --- Envíos ---------------------------------------------------------------- */

export interface Shipment {
  id: string;
  orderId: string;
  trackingNumber: string;
  status: ShipmentStatus;
  assignedTo: string | null;
  carrier: string | null;
  carrierTrackingNumber: string | null;
  carrierTrackingUrl: string | null;
  destination: Json;
  coordinates: Coordinates | null;
  deliveryNote: string | null;
  receivedBy: string | null;
  failureReason: string | null;
  estimatedAt: string | null;
  dispatchedAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
}

/**
 * Lee una fila de `shipments` y la deja utilizable.
 *
 * El estado llega como `text` desde la base. La restricción de la tabla ya
 * impide guardar cualquier otra cosa, pero eso no es lo que TypeScript sabe:
 * se comprueba aquí para que quien recibe un `Shipment` pueda confiar en el
 * tipo sin volver a validarlo en cada pantalla.
 */
function toShipment(fila: {
  id: string;
  order_id: string;
  tracking_number: string;
  status: string;
  assigned_to: string | null;
  carrier: string | null;
  carrier_tracking_number: string | null;
  carrier_tracking_url: string | null;
  destination: Json;
  latitude: number | null;
  longitude: number | null;
  delivery_note: string | null;
  received_by: string | null;
  failure_reason: string | null;
  estimated_at: string | null;
  dispatched_at: string | null;
  delivered_at: string | null;
  created_at: string;
}): Shipment {
  return {
    id: fila.id,
    orderId: fila.order_id,
    trackingNumber: fila.tracking_number,
    status: isShipmentStatus(fila.status) ? fila.status : 'pendiente',
    assignedTo: fila.assigned_to,
    carrier: fila.carrier,
    carrierTrackingNumber: fila.carrier_tracking_number,
    carrierTrackingUrl: fila.carrier_tracking_url,
    destination: fila.destination,
    coordinates:
      fila.latitude !== null && fila.longitude !== null
        ? { lat: fila.latitude, lng: fila.longitude }
        : null,
    deliveryNote: fila.delivery_note,
    receivedBy: fila.received_by,
    failureReason: fila.failure_reason,
    estimatedAt: fila.estimated_at,
    dispatchedAt: fila.dispatched_at,
    deliveredAt: fila.delivered_at,
    createdAt: fila.created_at,
  };
}

const CAMPOS_ENVIO =
  `id, order_id, tracking_number, status, assigned_to, carrier, carrier_tracking_number,
   carrier_tracking_url, destination, latitude, longitude, delivery_note, received_by,
   failure_reason, estimated_at, dispatched_at, delivered_at, created_at` as const;

/** Los envíos de un pedido, del más reciente al más antiguo. */
export async function listShipmentsByOrder(client: Client, orderId: string): Promise<Shipment[]> {
  const { data, error } = await client
    .from('shipments')
    .select(CAMPOS_ENVIO)
    .eq('order_id', orderId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map(toShipment);
}
