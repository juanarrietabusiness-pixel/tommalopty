import { cookies } from 'next/headers';
import {
  createSupabaseAnonClient,
  createSupabaseServerClient,
  createSupabaseServiceClient,
} from '@nebula/db';

/**
 * Cliente anónimo, sin cookies, para las lecturas que son iguales para todo el
 * mundo: catálogo, fichas, páginas del CMS, banners, menús y ajustes públicos.
 *
 * Úsalo en cualquier página que declare `revalidate`. El cliente de sesión de
 * abajo lee cookies, y leer cookies fuerza render dinámico: basta una llamada
 * para que la ISR de esa ruta deje de aplicarse y cada visita acabe pegando a
 * Postgres.
 *
 * No sirve para nada que dependa de quién mira. Para eso, el de abajo.
 */
export function getSupabaseAnonClient() {
  return createSupabaseAnonClient();
}

/**
 * Cliente Supabase para Server Components, Server Actions y Route Handlers.
 * Respeta la sesión del visitante, así que todo lo que devuelve pasa por RLS.
 *
 * OJO: lee cookies, así que la ruta que lo use se renderiza en cada visita.
 * Correcto para cuenta, pedidos, favoritos y carrito autenticado; para lo
 * público, `getSupabaseAnonClient`.
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

/**
 * Cliente con service-role: salta RLS.
 * Solo para operaciones sin sesión que ya validamos nosotros (webhooks de pago,
 * creación de pedidos, carritos de invitado).
 */
export function getSupabaseServiceClient() {
  return createSupabaseServiceClient();
}

/**
 * ¿Hay una instancia de Supabase configurada?
 *
 * Sin credenciales la tienda sigue renderizando con el contenido de
 * demostración del esqueleto, para poder revisar el diseño antes de conectar
 * la base de datos.
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
