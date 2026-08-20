import { createClient } from '@supabase/supabase-js';
import { getPublicSupabaseConfig, getServiceRoleKey } from '../env';
import type { Database } from '../generated/database.types';

/**
 * Cliente con service-role: SALTA RLS.
 *
 * Usar únicamente en servidor y solo donde no hay una sesión de usuario que
 * pueda autorizar la operación:
 *   - webhooks de las pasarelas de pago
 *   - creación de pedidos tras validar precios y stock
 *   - carritos de invitado (session_token)
 *   - tareas internas / migraciones de datos
 *
 * Nunca exponerlo en un componente de cliente ni en una respuesta HTTP.
 */
export function createSupabaseServiceClient() {
  const { url } = getPublicSupabaseConfig();

  return createClient<Database>(url, getServiceRoleKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
