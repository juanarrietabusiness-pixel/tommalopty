'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getSupabaseServerClient } from '@/lib/supabase';
import { requireStaff } from '@/lib/auth';
import {
  bloqueadoEnDemostracion,
  checkWrite,
  fromDatabaseError,
  fromZodError,
  success,
  type ActionResult,
} from './result';

/**
 * CRM: notas y etiquetas sobre la ficha del cliente.
 * Las notas internas nunca son visibles para el cliente (política RLS
 * `crm_notes_staff`), así que el equipo puede escribir con libertad.
 */
const noteSchema = z.object({
  customerId: z.uuid(),
  body: z.string().min(1, 'Escribe algo antes de guardar').max(2000),
  isPinned: z.boolean().default(false),
});

export async function addCustomerNote(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireStaff();

  const demo = bloqueadoEnDemostracion();
  if (demo) return demo;

  const parsed = noteSchema.safeParse({
    customerId: formData.get('customerId'),
    body: formData.get('body'),
    isPinned: formData.get('isPinned') === 'on',
  });

  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.from('crm_notes').insert({
    customer_id: parsed.data.customerId,
    author_id: session.userId,
    body: parsed.data.body,
    is_pinned: parsed.data.isPinned,
  });

  if (error) return fromDatabaseError(error);

  revalidatePath(`/clientes/${parsed.data.customerId}`);
  return success('Nota guardada.');
}

const tagsSchema = z.object({
  customerId: z.uuid(),
  tags: z.string().optional(),
});

export async function updateCustomerTags(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireStaff();

  const demo = bloqueadoEnDemostracion();
  if (demo) return demo;

  const parsed = tagsSchema.safeParse({
    customerId: formData.get('customerId'),
    tags: formData.get('tags') || undefined,
  });

  if (!parsed.success) return fromZodError(parsed.error);

  const tags = (parsed.data.tags ?? '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);

  const supabase = await getSupabaseServerClient();

  // Un operador llega hasta aquí (la acción exige `requireStaff`), pero RLS solo
  // deja escribir en `customers` a admin. Sin comprobar filas afectadas, el
  // panel le decía «Etiquetas actualizadas» sin haber cambiado nada.
  const problema = checkWrite(
    await supabase.from('customers').update({ tags }).eq('id', parsed.data.customerId).select('id'),
    'No se guardaron las etiquetas: hace falta rol de administrador.',
  );

  if (problema) return problema;

  revalidatePath(`/clientes/${parsed.data.customerId}`);
  return success('Etiquetas actualizadas.');
}
