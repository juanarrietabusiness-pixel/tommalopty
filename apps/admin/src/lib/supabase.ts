import { cookies } from 'next/headers';
import { createSupabaseServerClient, createSupabaseServiceClient } from '@nebula/db';

/**
 * Cliente del panel ligado a la sesión del operador.
 *
 * Se usa este —y no el de service-role— en todas las lecturas y escrituras del
 * panel: así RLS sigue siendo la barrera real y un operador nunca puede tocar
 * lo que su rol no permite, aunque la interfaz se lo ofreciera por error.
 */
export async function getSupabaseServerClient() {
  const cookieStore = await cookies();

  return createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: (cookiesToSet) => {
      for (const { name, value, options } of cookiesToSet) {
        cookieStore.set(name, value, options);
      }
    },
  });
}

/** Solo para tareas internas sin sesión. En el panel casi nunca hace falta. */
export function getSupabaseServiceClient() {
  return createSupabaseServiceClient();
}

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
