'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getSupabaseServerClient } from '@/lib/supabase';
import { requireAdmin, requireStaff } from '@/lib/auth';
import { failure, fromDatabaseError, fromZodError, success, type ActionResult } from './result';

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
  const { error } = await supabase
    .from('integrations')
    .update({
      is_enabled: parsed.data.isEnabled,
      environment: parsed.data.environment,
      updated_by: session.userId,
    })
    .eq('provider', parsed.data.provider);

  if (error) return fromDatabaseError(error);

  revalidatePath('/configuracion');
  return success('Integración actualizada.');
}

const roleSchema = z.object({
  profileId: z.uuid(),
  role: z.enum(['customer', 'operator', 'admin', 'superadmin']),
});

export async function updateUserRole(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireStaff();

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
  const { error } = await supabase
    .from('profiles')
    .update({ role: parsed.data.role })
    .eq('id', parsed.data.profileId);

  if (error) return fromDatabaseError(error);

  revalidatePath('/usuarios');
  return success('Rol actualizado.');
}
