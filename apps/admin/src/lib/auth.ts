import { cache } from 'react';
import { redirect } from 'next/navigation';
import type { Enums } from '@nebula/db';
import { getSupabaseServerClient } from './supabase';
import { esModoDemostracion } from './demo-mode';

export interface StaffSession {
  userId: string;
  email: string;
  fullName: string;
  role: Enums<'user_role'>;
}

const ROLE_LABELS: Record<Enums<'user_role'>, string> = {
  customer: 'Cliente',
  operator: 'Operador',
  admin: 'Administrador',
  superadmin: 'Superadministrador',
  // Un motorizado no entra al panel: entra a /motorizado, en la tienda. Aparece
  // aquí porque la lista de usuarios lo tiene que poder nombrar.
  courier: 'Motorizado',
};

export function roleLabel(role: Enums<'user_role'>): string {
  return ROLE_LABELS[role];
}

/**
 * Quién entra al panel. Es una lista de admitidos, no de excluidos.
 *
 * La diferencia no es de estilo. Antes esto decía «cualquiera menos
 * `customer`», y funcionó mientras `customer` fue el único rol de fuera del
 * equipo. En cuanto la fase L4 añadió `courier`, esa condición lo dejaba pasar:
 * un motorizado —alguien de fuera de la oficina, con la aplicación en su
 * teléfono— habría entrado al panel de administración sin que nadie escribiera
 * una línea para permitírselo.
 *
 * Con una lista de admitidos, el rol que se invente mañana queda fuera por
 * omisión. Es la misma lección de `grant ... on all tables`: lo que hay que
 * elegir es a quién se le da, no a quién se le quita.
 */
const ROLES_DEL_PANEL = new Set<Enums<'user_role'>>(['operator', 'admin', 'superadmin']);

/** ¿Este rol entra al panel? Mismo criterio que usa `readStaffSession`. */
export function entraAlPanel(role: Enums<'user_role'>): boolean {
  return ROLES_DEL_PANEL.has(role);
}

/**
 * Exige una sesión con rol de staff.
 *
 * La comprobación de rol es doble a propósito: aquí para no renderizar la
 * interfaz, y en RLS para que ninguna consulta devuelva datos aunque alguien
 * saltase esta guardia.
 */
/**
 * Sesión ficticia del modo demostración.
 *
 * Rol `admin` y no `superadmin` a propósito: así el recorrido enseña el panel
 * tal y como lo ve quien lo va a usar a diario, con las secciones de
 * superadministrador fuera. Nadie se lleva la impresión de que el panel tiene
 * menos secciones de las que tiene, ni más permisos de los que da.
 */
const SESION_DEMO: StaffSession = {
  userId: '00000000-0000-0000-0000-0000000000de',
  email: 'demostracion@nebula.local',
  fullName: 'Recorrido de demostración',
  role: 'admin',
};

/**
 * Lee la sesión de staff sin decidir qué hacer si no la hay.
 *
 * Existe separada de `requireStaff` porque redirigir solo vale en una pantalla.
 * Una ruta de API que redirige devuelve un 307 con HTML, y quien la llamó desde
 * `fetch` recibe algo que no puede leer en lugar de un error entendible.
 */
export const readStaffSession = cache(async (): Promise<StaffSession | null> => {
  // Sin Supabase configurado el panel no puede autenticar a nadie. Antes esto
  // reventaba con un 500 en las 17 pantallas y solo se veía la de acceso; ahora
  // se recorre entero en solo lectura. Ver `esModoDemostracion`.
  if (esModoDemostracion()) return SESION_DEMO;

  const supabase = await getSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, is_active')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile || !profile.is_active || !ROLES_DEL_PANEL.has(profile.role)) return null;

  return {
    userId: profile.id,
    email: profile.email,
    fullName: profile.full_name ?? profile.email,
    role: profile.role,
  };
});

export const requireStaff = cache(async (): Promise<StaffSession> => {
  const session = await readStaffSession();
  if (!session) redirect('/entrar?error=sin_permisos');
  return session;
});

/** Exige rol admin o superadmin (escritura). */
export async function requireAdmin(): Promise<StaffSession> {
  const session = await requireStaff();
  if (session.role === 'operator') redirect('/?error=sin_permisos');
  return session;
}

/**
 * Como `requireAdmin`, pero para rutas de API: devuelve `null` en vez de
 * redirigir, para que quien llame pueda responder con el estado correcto.
 */
export async function readWriteSession(): Promise<StaffSession | null> {
  const session = await readStaffSession();
  if (!session || !canWrite(session.role)) return null;
  return session;
}

export function canWrite(role: Enums<'user_role'>): boolean {
  return role === 'admin' || role === 'superadmin';
}

export function isSuperadmin(role: Enums<'user_role'>): boolean {
  return role === 'superadmin';
}

export { esModoDemostracion };
