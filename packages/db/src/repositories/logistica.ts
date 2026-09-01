import type { SupabaseClient } from '@supabase/supabase-js';
import {
  isEstadoMotorizado,
  isShipmentStatus,
  isVehiculo,
  parsePolygon,
  type Coordinates,
  type DeliveryZone,
  type DocumentoDelMotorizado,
  type EstadoMotorizado,
  type ShipmentStatus,
  type Vehiculo,
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

/* --- Motorizados ----------------------------------------------------------- */

export interface Motorizado {
  id: string;
  profileId: string;
  displayName: string;
  phone: string | null;
  nationalId: string | null;
  vehicleType: Vehiculo;
  plate: string | null;
  rate: number | null;
  status: EstadoMotorizado;
  documents: DocumentoDelMotorizado[];
  notes: string | null;
  /** Identificadores de las zonas que cubre. */
  zoneIds: string[];
  createdAt: string;
}

/**
 * Los papeles llegan como `jsonb`, así que llegan sin tipar.
 *
 * Un documento a medio escribir es peor que ninguno: haría que el aviso de
 * vencimiento hablara de un papel sin nombre, o que una fecha inventada diera
 * por vencida una licencia que está en regla. Lo que no encaja se descarta.
 */
function toDocumentos(valor: Json): DocumentoDelMotorizado[] {
  if (!Array.isArray(valor)) return [];

  const documentos: DocumentoDelMotorizado[] = [];

  for (const bruto of valor) {
    if (typeof bruto !== 'object' || bruto === null || Array.isArray(bruto)) continue;

    const campos = bruto as Record<string, unknown>;
    const tipo = typeof campos.tipo === 'string' ? campos.tipo.trim() : '';
    if (!tipo) continue;

    documentos.push({
      tipo,
      numero: typeof campos.numero === 'string' ? campos.numero : undefined,
      vence: typeof campos.vence === 'string' ? campos.vence : undefined,
    });
  }

  return documentos;
}

const CAMPOS_MOTORIZADO =
  `id, profile_id, display_name, phone, national_id, vehicle_type, plate, rate,
   status, documents, notes, created_at` as const;

interface FilaMotorizado {
  id: string;
  profile_id: string;
  display_name: string;
  phone: string | null;
  national_id: string | null;
  vehicle_type: string;
  plate: string | null;
  rate: number | null;
  status: string;
  documents: Json;
  notes: string | null;
  created_at: string;
}

function toMotorizado(fila: FilaMotorizado, zoneIds: string[]): Motorizado {
  return {
    id: fila.id,
    profileId: fila.profile_id,
    displayName: fila.display_name,
    phone: fila.phone,
    nationalId: fila.national_id,
    // Igual que con el estado del envío: la restricción de la tabla ya impide
    // guardar otra cosa, pero eso no es lo que TypeScript sabe. Se comprueba
    // aquí para que las pantallas puedan confiar en el tipo.
    vehicleType: isVehiculo(fila.vehicle_type) ? fila.vehicle_type : 'moto',
    plate: fila.plate,
    rate: fila.rate === null ? null : Number(fila.rate),
    status: isEstadoMotorizado(fila.status) ? fila.status : 'inactivo',
    documents: toDocumentos(fila.documents),
    notes: fila.notes,
    zoneIds,
    createdAt: fila.created_at,
  };
}

/**
 * Todos los motorizados, con las zonas que cubre cada uno.
 *
 * Dos consultas y no un `join` anidado: PostgREST devuelve las relaciones
 * embebidas con una forma que cambia según haya cero, una o varias filas, y
 * desenredarla cuesta más que pedir las zonas aparte. Son dos consultas por
 * pantalla, no por motorizado.
 */
export async function listCouriers(
  client: Client,
  opciones: { soloActivos?: boolean } = {},
): Promise<Motorizado[]> {
  let consulta = client.from('couriers').select(CAMPOS_MOTORIZADO).order('display_name');

  // Los inactivos siguen apareciendo en el panel por defecto: es justo a quien
  // hay que poder volver a activar.
  if (opciones.soloActivos) consulta = consulta.eq('status', 'activo');

  const { data, error } = await consulta;
  if (error) throw error;

  const filas = (data ?? []) as FilaMotorizado[];
  if (filas.length === 0) return [];

  const { data: zonas, error: errorZonas } = await client
    .from('courier_zones')
    .select('courier_id, zone_id')
    .in(
      'courier_id',
      filas.map((fila) => fila.id),
    );

  if (errorZonas) throw errorZonas;

  const porMotorizado = new Map<string, string[]>();
  for (const fila of zonas ?? []) {
    const lista = porMotorizado.get(fila.courier_id) ?? [];
    lista.push(fila.zone_id);
    porMotorizado.set(fila.courier_id, lista);
  }

  return filas.map((fila) => toMotorizado(fila, porMotorizado.get(fila.id) ?? []));
}

/**
 * Los envíos que lleva encima quien consulta.
 *
 * No recibe el identificador del motorizado: lo decide RLS a partir de la
 * sesión. Pasarlo como parámetro habría dejado la puerta abierta a consultar los
 * de otro —la política lo impediría, pero una pantalla que pide lo que no puede
 * tener es una pantalla que un día se despliega sin la política.
 */
export async function listMisEnvios(client: Client): Promise<Shipment[]> {
  const { data, error } = await client
    .from('shipments')
    .select(CAMPOS_ENVIO)
    // Lo entregado y lo devuelto no se listan: la pantalla es «lo que llevo
    // encima», y una lista que crece para siempre deja de servir en la calle.
    .not('status', 'in', '("entregado","devuelto")')
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []).map(toShipment);
}

/** Lo cerrado hoy por quien consulta: es la pantalla de «mi día». */
export async function listMiDia(client: Client, desdeISO: string): Promise<Shipment[]> {
  const { data, error } = await client
    .from('shipments')
    .select(CAMPOS_ENVIO)
    .in('status', ['entregado', 'fallido'])
    .gte('updated_at', desdeISO)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map(toShipment);
}
