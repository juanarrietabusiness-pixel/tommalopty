'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getSupabaseServerClient, isSupabaseConfigured } from '@/lib/supabase';

/**
 * Datos personales del panel de cliente.
 *
 * Solo se escriben las cuatro columnas que son suyas. No es una decisión de
 * este archivo: `guard_customer_identity` rechaza en la base de datos cualquier
 * intento de tocar email, métricas o etiquetas, así que aunque alguien llame a
 * esta acción con campos de más, no pasarán de aquí.
 */

export interface AccountResult {
  status: 'idle' | 'success' | 'error';
  message?: string;
  fieldErrors?: Record<string, string[]>;
}

export const ACCOUNT_IDLE: AccountResult = { status: 'idle' };

const perfilSchema = z.object({
  firstName: z.string().trim().min(1, 'Escribe tu nombre').max(80, 'Máximo 80 caracteres'),
  lastName: z.string().trim().max(80, 'Máximo 80 caracteres'),
  phone: z
    .string()
    .trim()
    .max(30, 'Máximo 30 caracteres')
    // Se acepta cualquier forma de escribir un teléfono panameño (con guion,
    // con prefijo, con espacios) y se rechaza lo que no puede serlo. Validar
    // más fino aquí solo consigue rechazar teléfonos válidos.
    .refine((value) => value === '' || /^[+\d][\d\s\-().]{5,}$/.test(value), {
      message: 'Ese teléfono no parece válido.',
    }),
  acceptsMarketing: z.boolean(),
});

export async function updateMyProfile(
  _previous: AccountResult,
  formData: FormData,
): Promise<AccountResult> {
  if (!isSupabaseConfigured()) {
    return {
      status: 'error',
      message: 'Esto es una demostración: se puede navegar la cuenta, pero no se guarda nada.',
    };
  }

  const parsed = perfilSchema.safeParse({
    firstName: String(formData.get('firstName') ?? ''),
    lastName: String(formData.get('lastName') ?? ''),
    phone: String(formData.get('phone') ?? ''),
    acceptsMarketing: formData.get('acceptsMarketing') === 'on',
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.') || '_';
      fieldErrors[key] = [...(fieldErrors[key] ?? []), issue.message];
    }
    return { status: 'error', message: 'Revisa los campos marcados.', fieldErrors };
  }

  const input = parsed.data;
  const supabase = await getSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { status: 'error', message: 'Tu sesión ha caducado. Vuelve a entrar.' };

  // El filtro por `profile_id` es redundante con RLS a propósito: si algún día
  // la política cambiara, esta consulta seguiría tocando una sola ficha.
  const { data, error } = await supabase
    .from('customers')
    .update({
      first_name: input.firstName,
      last_name: input.lastName === '' ? null : input.lastName,
      phone: input.phone === '' ? null : input.phone,
      accepts_marketing: input.acceptsMarketing,
    })
    .eq('profile_id', user.id)
    .select('id');

  if (error) {
    // 42501 lo lanza `guard_customer_identity` con su propio mensaje, que es
    // más útil que uno genérico.
    if (error.code === '42501') return { status: 'error', message: error.message };
    return { status: 'error', message: 'No se pudieron guardar los cambios.' };
  }

  // RLS filtra los UPDATE sin devolver error: cero filas significa que la
  // política no autorizó la escritura, no que todo fuera bien.
  if (!data || data.length === 0) {
    return { status: 'error', message: 'No encontramos tu ficha de cliente.' };
  }

  revalidatePath('/cuenta');
  revalidatePath('/cuenta/datos');
  return { status: 'success', message: 'Datos actualizados.' };
}
