import type { SupabaseClient } from '@supabase/supabase-js';
import { parsePolygon, type DeliveryZone } from '@nebula/domain';
import type { Database } from '../generated/database.types';

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
