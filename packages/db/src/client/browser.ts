import { createBrowserClient } from '@supabase/ssr';
import { getPublicSupabaseConfig } from '../env';
import type { Database } from '../generated/database.types';

/**
 * Cliente para componentes de cliente. Usa la anon key: todo lo que devuelva
 * está filtrado por las políticas RLS del usuario autenticado.
 */
export function createSupabaseBrowserClient() {
  const { url, anonKey } = getPublicSupabaseConfig();
  return createBrowserClient<Database>(url, anonKey);
}
