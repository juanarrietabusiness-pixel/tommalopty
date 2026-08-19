import { createServerClient } from '@supabase/ssr';
import { getPublicSupabaseConfig } from '../env';
import type { Database } from '../generated/database.types';

/**
 * Adaptador de cookies. Cada app Next pasa el suyo (envolviendo `cookies()` de
 * `next/headers`), de modo que este paquete no depende de Next y puede usarse
 * también desde Workers o Edge Functions.
 */
export interface CookieAdapter {
  getAll: () => { name: string; value: string }[];
  setAll: (cookies: { name: string; value: string; options?: Record<string, unknown> }[]) => void;
}

export function createSupabaseServerClient(cookies: CookieAdapter) {
  const { url, anonKey } = getPublicSupabaseConfig();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll: () => cookies.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookies.setAll(cookiesToSet);
        } catch {
          // En Server Components no se pueden escribir cookies; el middleware
          // ya refresca la sesión, así que ignorar aquí es lo correcto.
        }
      },
    },
  });
}
