'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getSupabaseServerClient } from '@/lib/supabase';
import { requireAdmin, requireStaff } from '@/lib/auth';
import {
  bloqueadoEnDemostracion,
  checkWrite,
  failure,
  fromZodError,
  success,
  type ActionResult,
} from './result';

/**
 * Integraciones y roles.
 *
 * Aquí solo se guarda el interruptor de activación y configuración NO sensible.
 * Las claves de pasarelas, Meta y email viven en variables de entorno del
 * hosting: nunca en la base de datos (brief §7).
 */
const integrationSchema = z.object({
  provider: z.string().min(2),
  isEnabled: z.boolean(),
  environment: z.enum(['sandbox', 'production']),
});

export async function updateIntegration(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireAdmin();

  const demo = bloqueadoEnDemostracion();
  if (demo) return demo;

  if (session.role !== 'superadmin') {
    return failure('Solo un superadministrador puede cambiar las integraciones.');
  }

  const parsed = integrationSchema.safeParse({
    provider: formData.get('provider'),
    isEnabled: formData.get('isEnabled') === 'on',
    environment: formData.get('environment'),
  });

  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await getSupabaseServerClient();
  const problema = checkWrite(
    await supabase
      .from('integrations')
      .update({
        is_enabled: parsed.data.isEnabled,
        environment: parsed.data.environment,
        updated_by: session.userId,
      })
      .eq('provider', parsed.data.provider)
      .select('provider'),
  );

  if (problema) return problema;

  revalidatePath('/configuracion');
  return success('Integración actualizada.');
}

const roleSchema = z.object({
  profileId: z.uuid(),
  role: z.enum(['customer', 'operator', 'admin', 'superadmin', 'courier']),
});

export async function updateUserRole(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireStaff();

  const demo = bloqueadoEnDemostracion();
  if (demo) return demo;

  // La política RLS `profiles_superadmin_all` ya lo impide; comprobarlo aquí
  // evita mostrar un error de base de datos por algo que es una regla de negocio.
  if (session.role !== 'superadmin') {
    return failure('Solo un superadministrador puede cambiar roles.');
  }

  const parsed = roleSchema.safeParse({
    profileId: formData.get('profileId'),
    role: formData.get('role'),
  });

  if (!parsed.success) return fromZodError(parsed.error);

  if (parsed.data.profileId === session.userId) {
    return failure('No puedes cambiar tu propio rol.');
  }

  const supabase = await getSupabaseServerClient();
  const problema = checkWrite(
    await supabase
      .from('profiles')
      .update({ role: parsed.data.role })
      .eq('id', parsed.data.profileId)
      .select('id'),
    'No se cambió el rol: hace falta ser superadministrador.',
  );

  if (problema) return problema;

  revalidatePath('/usuarios');
  return success('Rol actualizado.');
}

/**
 * Activar o desactivar una cuenta del panel.
 *
 * Una cuenta del panel no se borra: se desactiva. Borrarla dejaría huérfano
 * todo lo que firmó —pedidos tocados, notas del CRM, despachos asignados— y esa
 * trazabilidad es justo lo que hace útil el registro.
 *
 * Toda la mitad de abajo existía desde hace meses: el middleware ya echa a
 * quien tiene `is_active = false`, `current_app_role()` devuelve nulo para esa
 * cuenta, y `guard_profile_privileges` reserva el cambio al superadministrador.
 * Lo que no existía era el interruptor. La pantalla enseñaba el estado y no
 * dejaba cambiarlo, así que la única forma de cerrar el acceso a alguien que se
 * va era entrar en la base de datos a mano.
 */
const estadoDeCuentaSchema = z.object({
  profileId: z.uuid(),
  // Llega el estado que se quiere dejar, no «alternar»: si dos personas abren
  // la pantalla a la vez, alternar deja el resultado a merced del orden.
  activo: z.enum(['si', 'no']),
});

export async function setUserActive(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireStaff();

  const demo = bloqueadoEnDemostracion();
  if (demo) return demo;

  if (session.role !== 'superadmin') {
    return failure('Solo un superadministrador puede activar o desactivar cuentas.');
  }

  const parsed = estadoDeCuentaSchema.safeParse({
    profileId: formData.get('profileId'),
    activo: formData.get('activo'),
  });

  if (!parsed.success) return fromZodError(parsed.error);

  // Desactivarse a uno mismo cierra la sesión en el siguiente clic y deja la
  // tienda sin superadministrador si era el último. No hay forma de deshacerlo
  // desde el panel: haría falta entrar en la base de datos.
  if (parsed.data.profileId === session.userId) {
    return failure('No puedes desactivar tu propia cuenta.');
  }

  const activo = parsed.data.activo === 'si';
  const supabase = await getSupabaseServerClient();
  const problema = checkWrite(
    await supabase
      .from('profiles')
      .update({ is_active: activo })
      .eq('id', parsed.data.profileId)
      .select('id'),
    'No se cambió el estado: hace falta ser superadministrador.',
  );

  if (problema) return problema;

  revalidatePath('/usuarios');
  return success(
    activo
      ? 'Cuenta reactivada. Ya puede entrar al panel.'
      : 'Cuenta desactivada. Deja de entrar al panel en cuanto se recargue.',
  );
}
