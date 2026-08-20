import { createClient } from '@supabase/supabase-js';
import { getPublicSupabaseConfig } from '../env';
import type { Database } from '../generated/database.types';

/**
 * Cliente anónimo, SIN cookies. Para todo lo que es igual para cualquier
 * visitante: catálogo, fichas de producto, páginas del CMS, banners, menús y
 * ajustes públicos.
 *
 * Por qué existe, y por qué importa más de lo que parece:
 *
 * El cliente de servidor lee las cookies de la petición para respetar la sesión.
 * Leer cookies en Next fuerza render dinámico, y eso anula la ISR de la página
 * entera aunque declare `revalidate`. Con las cuatro rutas públicas declarando
 * revalidación, el efecto real era que CADA visita a una ficha de producto
 * llegaba a Postgres. Es la diferencia entre aguantar una campaña de marketing y
 * caerse durante ella.
 *
 * No pierde seguridad: usa la anon key y RLS filtra exactamente lo que un
 * visitante sin sesión puede ver, que es justo lo que estas páginas muestran. Lo
 * que no debe usarse aquí es nada que dependa de quién mira —cuenta, pedidos,
 * favoritos, carrito autenticado—: para eso está `createSupabaseServerClient`.
 */
export function createSupabaseAnonClient() {
  const { url, anonKey } = getPublicSupabaseConfig();

  return createClient<Database>(url, anonKey, {
    auth: {
      // Sin sesión que guardar ni refrescar: este cliente no representa a nadie.
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
