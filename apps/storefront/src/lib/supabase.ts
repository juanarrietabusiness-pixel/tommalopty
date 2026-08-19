import { cookies } from 'next/headers';
import { createSupabaseServerClient, createSupabaseServiceClient } from '@nebula/db';

/**
 * Cliente Supabase para Server Components, Server Actions y Route Handlers.
 * Respeta la sesión del visitante, así que todo lo que devuelve pasa por RLS.
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
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
