'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getSupabaseServerClient, isSupabaseConfigured } from '@/lib/supabase';
// `ACCOUNT_IDLE` y `AccountResult` viven fuera de este fichero a propósito: un
// módulo `'use server'` solo puede exportar funciones asíncronas, y exportar
// desde aquí un objeto rompía el módulo entero. Ver `cuenta-result.ts`.
import type { AccountResult } from './cuenta-result';

/**
 * Datos personales del panel de cliente.
 *
 * Solo se escriben las cuatro columnas que son suyas. No es una decisión de
 * este archivo: `guard_customer_identity` rechaza en la base de datos cualquier
 * intento de tocar email, métricas o etiquetas, así que aunque alguien llame a
 * esta acción con campos de más, no pasarán de aquí.
 */

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

/* --- Direcciones ----------------------------------------------------------- */

/**
 * El alta, la edición y el borrado de direcciones.
 *
 * La tabla `addresses` existía desde el principio, con su RLS completa
 * —`addresses_own ... for all`, así que el cliente siempre pudo crear, editar y
 * borrar las suyas— y una pantalla que las leía. Lo que no existía era nada que
 * escribiera: ni formulario ni acción. La pantalla solo podía decir «aún no has
 * guardado ninguna dirección», para siempre.
 *
 * Peor: decía «la que uses en tu próximo pedido aparecerá aquí», y era falso.
 * El checkout guarda la dirección como instantánea dentro del pedido
 * (`orders.shipping_address`), no aquí. Comprar no llenaba esta pantalla.
 *
 * No se apoya en RLS a secas: cada consulta filtra además por la ficha del
 * cliente de la sesión. Es redundante a propósito —si la política cambiara, la
 * consulta seguiría tocando solo lo suyo— y es la misma cautela que ya usa
 * `updateMyProfile`.
 */

const direccionSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().trim().max(40, 'Máximo 40 caracteres'),
  firstName: z.string().trim().min(1, 'Escribe el nombre').max(80, 'Máximo 80 caracteres'),
  lastName: z.string().trim().min(1, 'Escribe el apellido').max(80, 'Máximo 80 caracteres'),
  line1: z.string().trim().min(1, 'Escribe la dirección').max(200, 'Máximo 200 caracteres'),
  line2: z.string().trim().max(200, 'Máximo 200 caracteres'),
  city: z.string().trim().min(1, 'Escribe la ciudad').max(80, 'Máximo 80 caracteres'),
  province: z.string().trim().max(80, 'Máximo 80 caracteres'),
  postalCode: z.string().trim().max(20, 'Máximo 20 caracteres'),
  phone: z
    .string()
    .trim()
    .max(30, 'Máximo 30 caracteres')
    .refine((value) => value === '' || /^[+\d][\d\s\-().]{5,}$/.test(value), {
      message: 'Ese teléfono no parece válido.',
    }),
  isDefault: z.boolean(),
});

function erroresDeCampo(error: z.ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    fieldErrors[key] = [...(fieldErrors[key] ?? []), issue.message];
  }
  return fieldErrors;
}

/** La ficha de cliente de quien tiene la sesión abierta, o `null`. */
async function miFichaDeCliente(): Promise<{ id: string } | null> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase
    .from('customers')
    .select('id')
    .eq('profile_id', user.id)
    .maybeSingle();

  return data ?? null;
}

export async function saveMyAddress(
  _previous: AccountResult,
  formData: FormData,
): Promise<AccountResult> {
  if (!isSupabaseConfigured()) {
    return {
      status: 'error',
      message: 'Esto es una demostración: se puede navegar la cuenta, pero no se guarda nada.',
    };
  }

  const id = String(formData.get('id') ?? '');
  const parsed = direccionSchema.safeParse({
    id: id === '' ? undefined : id,
    label: String(formData.get('label') ?? ''),
    firstName: String(formData.get('firstName') ?? ''),
    lastName: String(formData.get('lastName') ?? ''),
    line1: String(formData.get('line1') ?? ''),
    line2: String(formData.get('line2') ?? ''),
    city: String(formData.get('city') ?? ''),
    province: String(formData.get('province') ?? ''),
    postalCode: String(formData.get('postalCode') ?? ''),
    phone: String(formData.get('phone') ?? ''),
    isDefault: formData.get('isDefault') === 'on',
  });

  if (!parsed.success) {
    return {
      status: 'error',
      message: 'Revisa los campos marcados.',
      fieldErrors: erroresDeCampo(parsed.error),
    };
  }

  const input = parsed.data;
  const ficha = await miFichaDeCliente();
  if (!ficha) return { status: 'error', message: 'Tu sesión ha caducado. Vuelve a entrar.' };

  const supabase = await getSupabaseServerClient();

  const fila = {
    customer_id: ficha.id,
    // Explícito y no por defecto: la consulta que desmarca la predeterminada
    // filtra por `type`, y las dos tienen que hablar del mismo tipo o el índice
    // único parcial `addresses_default_key` acabaría con dos marcadas.
    type: 'shipping' as const,
    label: input.label === '' ? null : input.label,
    first_name: input.firstName,
    last_name: input.lastName,
    line1: input.line1,
    line2: input.line2 === '' ? null : input.line2,
    city: input.city,
    province: input.province === '' ? null : input.province,
    postal_code: input.postalCode === '' ? null : input.postalCode,
    phone: input.phone === '' ? null : input.phone,
    is_default: input.isDefault,
  };

  // Solo puede haber una predeterminada por tipo: hay un índice único parcial
  // que lo garantiza (`addresses_default_key`). Se quita la anterior antes de
  // poner la nueva, o el índice rechazaría la escritura con un error que no
  // le dice nada a quien la hizo.
  if (input.isDefault) {
    await supabase
      .from('addresses')
      .update({ is_default: false })
      .eq('customer_id', ficha.id)
      .eq('type', 'shipping');
  }

  const { data, error } = input.id
    ? await supabase
        .from('addresses')
        .update(fila)
        .eq('id', input.id)
        .eq('customer_id', ficha.id)
        .select('id')
    : await supabase.from('addresses').insert(fila).select('id');

  if (error) return { status: 'error', message: 'No se pudo guardar la dirección.' };

  // RLS filtra los UPDATE sin devolver error: cero filas no es «todo bien».
  if (!data || data.length === 0) {
    return { status: 'error', message: 'No encontramos esa dirección.' };
  }

  revalidatePath('/cuenta/direcciones');
  return {
    status: 'success',
    message: input.id ? 'Dirección actualizada.' : 'Dirección guardada.',
  };
}

export async function deleteMyAddress(addressId: string): Promise<AccountResult> {
  if (!isSupabaseConfigured()) {
    return {
      status: 'error',
      message: 'Esto es una demostración: se puede navegar la cuenta, pero no se guarda nada.',
    };
  }

  const ficha = await miFichaDeCliente();
  if (!ficha) return { status: 'error', message: 'Tu sesión ha caducado. Vuelve a entrar.' };

  const supabase = await getSupabaseServerClient();

  const { data, error } = await supabase
    .from('addresses')
    .delete()
    .eq('id', addressId)
    .eq('customer_id', ficha.id)
    .select('id');

  if (error) return { status: 'error', message: 'No se pudo borrar la dirección.' };
  if (!data || data.length === 0) {
    return { status: 'error', message: 'No encontramos esa dirección.' };
  }

  // Borrar una dirección no toca ningún pedido: el pedido guarda su propia
  // instantánea de la dirección en `orders.shipping_address`, precisamente para
  // que cambiar o borrar esta no reescriba el histórico.
  revalidatePath('/cuenta/direcciones');
  return { status: 'success', message: 'Dirección borrada.' };
}
