'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase';
import { getBucketPrivado } from '@/lib/media-privada';
import { requireStaff } from '@/lib/auth';
import {
  bloqueadoEnDemostracion,
  checkWrite,
  failure,
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

/**
 * Anonimizar un cliente (issue #46).
 *
 * POR QUÉ ESTO Y NO UN BORRADO
 *
 * Borrar la ficha se lleva por delante lo que no se puede perder: las ventas
 * quedan huérfanas y la contabilidad sin a quién atribuirlas. Lo que de verdad
 * se pide cuando alguien dice «bórralo» es que sus datos personales dejen de
 * estar, y eso es esto. La función `anonimizar_cliente` de la migración 0036
 * explica en su cabecera qué se va y qué se queda.
 *
 * LAS DOS MITADES QUE POSTGRES NO PUEDE HACER
 *
 * La función devuelve, en vez de intentar, las dos cosas que viven fuera de la
 * base de datos, y esta acción las remata:
 *
 *   1. Las fotos de prueba de entrega, en el bucket privado de R2. Son la
 *      puerta de casa de alguien; dejarlas ahí convertiría la anonimización en
 *      un gesto.
 *   2. La cuenta de acceso en `auth.users`, que es donde vive el correo de
 *      verdad. Se borra con la clave de servicio.
 *
 * Y las dos se informan por separado en el mensaje. Una anonimización que dice
 * «hecho» habiendo fallado en cualquiera de las dos es peor que una que falla:
 * nadie vuelve a mirar lo que ya dio por bueno.
 */
export async function anonimizarCliente(customerId: string): Promise<ActionResult> {
  const session = await requireStaff();

  const demo = bloqueadoEnDemostracion();
  if (demo) return demo;

  // La función SQL lo vuelve a comprobar con `is_superadmin()`, y esa es la que
  // no se puede saltar. Esta está aquí para dar un mensaje entendible en vez de
  // un error 42501 de Postgres.
  if (session.role !== 'superadmin') {
    return failure('Solo un superadministrador puede anonimizar un cliente.');
  }

  if (!z.uuid().safeParse(customerId).success) return failure('Ese cliente ya no existe.');

  const supabase = await getSupabaseServerClient();

  const { data, error } = await supabase.rpc('anonimizar_cliente', {
    p_customer_id: customerId,
  });

  if (error) return fromDatabaseError(error);

  const resumen = Array.isArray(data) ? data[0] : data;
  if (!resumen) return failure('No se pudo anonimizar: la ficha no devolvió resultado.');

  const pendientes: string[] = [];

  // --- 1. Las fotos de prueba de entrega ------------------------------------
  const claves = resumen.pruebas_de_entrega ?? [];
  if (claves.length > 0) {
    const bucket = getBucketPrivado();

    if (!bucket) {
      pendientes.push(
        `${claves.length} ${claves.length === 1 ? 'foto' : 'fotos'} de prueba de entrega ` +
          'siguen en el almacenamiento privado: no había bucket enlazado.',
      );
    } else {
      const fallidas: string[] = [];
      for (const clave of claves) {
        try {
          await bucket.delete(clave);
        } catch (problema) {
          console.error(`[anonimizar] no se pudo borrar "${clave}" del bucket privado`, problema);
          fallidas.push(clave);
        }
      }
      if (fallidas.length > 0) {
        pendientes.push(
          `${fallidas.length} de ${claves.length} fotos de prueba de entrega no se pudieron borrar.`,
        );
      }
    }
  }

  // --- 2. La cuenta de acceso ------------------------------------------------
  if (resumen.cuenta_de_acceso) {
    try {
      const servicio = getSupabaseServiceClient();
      const { error: errorCuenta } = await servicio.auth.admin.deleteUser(resumen.cuenta_de_acceso);
      if (errorCuenta) throw errorCuenta;
    } catch (problema) {
      console.error('[anonimizar] no se pudo borrar la cuenta de acceso', problema);
      pendientes.push(
        'La cuenta de acceso sigue existiendo con su correo. Está desactivada, pero hay que ' +
          'borrarla desde Supabase Auth.',
      );
    }
  }

  revalidatePath('/clientes');
  revalidatePath(`/clientes/${customerId}`);

  const hecho =
    `Cliente anonimizado. Se conservan ${resumen.pedidos} ${resumen.pedidos === 1 ? 'pedido' : 'pedidos'} ` +
    `con sus importes; se borraron ${resumen.direcciones} direcciones, ${resumen.notas} notas y ` +
    `${resumen.suscripciones} suscripciones.`;

  if (pendientes.length > 0) {
    return failure(`${hecho} PERO QUEDA POR HACER: ${pendientes.join(' ')}`);
  }

  return success(hecho);
}
