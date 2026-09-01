'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { ESTADOS_MOTORIZADO, VEHICULOS } from '@nebula/domain';
import { getSupabaseServerClient } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';
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
 * Alta y gestión de motorizados.
 *
 * DAR DE ALTA A UN MOTORIZADO SON DOS COSAS, NO UNA
 *
 * Hace falta una cuenta —que la crea la persona registrándose en la tienda, como
 * cualquiera— y una ficha que la señale como motorizado. Aquí solo se hace lo
 * segundo. La alternativa era crear cuentas desde el panel, y eso obliga a
 * inventarle una contraseña a alguien y a mandársela por WhatsApp, que es
 * exactamente como se filtran las credenciales de reparto.
 *
 * Así que el flujo es: la persona se registra, y quien administra la busca por
 * su correo y la convierte en motorizado. Lo mismo que ya se hace para dar
 * permisos de operador.
 */

const motorizadoSchema = z.object({
  profileId: z.uuid('Elige a la persona de la lista'),
  displayName: z.string().trim().min(2, 'Ponle el nombre con el que lo llaman'),
  phone: z.string().trim().max(40).optional(),
  nationalId: z.string().trim().max(40).optional(),
  vehicleType: z.enum(VEHICULOS),
  plate: z.string().trim().max(20).optional(),
  rate: z
    .string()
    .trim()
    .optional()
    .transform((valor) => (valor === '' || valor === undefined ? null : Number(valor)))
    .refine((valor) => valor === null || (Number.isFinite(valor) && valor >= 0), {
      message: 'La tarifa tiene que ser un número de cero para arriba.',
    }),
  status: z.enum(ESTADOS_MOTORIZADO),
  notes: z.string().trim().max(500).optional(),
  /** Identificadores de zona, tal como llegan de las casillas del formulario. */
  zoneIds: z.array(z.uuid()).default([]),
});

function leerFormulario(formData: FormData) {
  return motorizadoSchema.safeParse({
    profileId: formData.get('profileId'),
    displayName: formData.get('displayName'),
    phone: formData.get('phone') || undefined,
    nationalId: formData.get('nationalId') || undefined,
    vehicleType: formData.get('vehicleType') ?? 'moto',
    plate: formData.get('plate') || undefined,
    rate: String(formData.get('rate') ?? ''),
    status: formData.get('status') ?? 'activo',
    notes: formData.get('notes') || undefined,
    zoneIds: formData.getAll('zoneIds').map(String),
  });
}

/**
 * Deja las zonas de un motorizado exactamente como dice el formulario.
 *
 * Borra y vuelve a insertar en vez de calcular la diferencia: son cinco o seis
 * filas por persona, la diferencia no ahorra nada medible, y el código que la
 * calcula es donde se cuelan las zonas fantasma que nadie sabe de dónde salen.
 */
async function guardarZonas(
  supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>,
  courierId: string,
  zoneIds: string[],
): Promise<ActionResult | null> {
  const { error: errorBorrado } = await supabase
    .from('courier_zones')
    .delete()
    .eq('courier_id', courierId);

  if (errorBorrado) return fromDatabaseError(errorBorrado);

  if (zoneIds.length === 0) return null;

  const { error } = await supabase
    .from('courier_zones')
    .insert(zoneIds.map((zoneId) => ({ courier_id: courierId, zone_id: zoneId })));

  return error ? fromDatabaseError(error) : null;
}

export async function crearMotorizado(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();

  const demo = bloqueadoEnDemostracion();
  if (demo) return demo;

  const parsed = leerFormulario(formData);
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await getSupabaseServerClient();
  const datos = parsed.data;

  // El rol y la ficha van juntos, y en este orden. Sin el rol, `is_courier()`
  // devuelve falso y la persona no vería ni sus propios envíos: tendría ficha y
  // no podría entrar, que es el fallo más difícil de diagnosticar de los dos.
  const problemaRol = checkWrite(
    await supabase
      .from('profiles')
      .update({ role: 'courier' })
      .eq('id', datos.profileId)
      .select('id'),
  );

  if (problemaRol) return problemaRol;

  const { data: creado, error } = await supabase
    .from('couriers')
    .insert({
      profile_id: datos.profileId,
      display_name: datos.displayName,
      phone: datos.phone ?? null,
      national_id: datos.nationalId ?? null,
      vehicle_type: datos.vehicleType,
      plate: datos.plate ?? null,
      rate: datos.rate,
      status: datos.status,
      notes: datos.notes ?? null,
    })
    .select('id')
    .single();

  if (error) {
    // 23505 = clave única. Es el caso de dar de alta dos veces a la misma
    // persona, y merece un mensaje mejor que el de Postgres.
    if (error.code === '23505') {
      return failure('Esa persona ya está dada de alta como motorizado.');
    }
    return fromDatabaseError(error);
  }

  const problemaZonas = await guardarZonas(supabase, creado.id, datos.zoneIds);
  if (problemaZonas) return problemaZonas;

  revalidatePath('/motorizados');
  return success(`${datos.displayName} ya puede entrar a la aplicación de reparto.`);
}

export async function actualizarMotorizado(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();

  const demo = bloqueadoEnDemostracion();
  if (demo) return demo;

  const courierId = String(formData.get('courierId') ?? '');
  if (!z.uuid().safeParse(courierId).success) return failure('No sabemos a quién actualizar.');

  const parsed = leerFormulario(formData);
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await getSupabaseServerClient();
  const datos = parsed.data;

  const problema = checkWrite(
    await supabase
      .from('couriers')
      .update({
        display_name: datos.displayName,
        phone: datos.phone ?? null,
        national_id: datos.nationalId ?? null,
        vehicle_type: datos.vehicleType,
        plate: datos.plate ?? null,
        rate: datos.rate,
        status: datos.status,
        notes: datos.notes ?? null,
      })
      .eq('id', courierId)
      .select('id'),
  );

  if (problema) return problema;

  const problemaZonas = await guardarZonas(supabase, courierId, datos.zoneIds);
  if (problemaZonas) return problemaZonas;

  revalidatePath('/motorizados');
  return success('Motorizado actualizado.');
}

/**
 * Da de baja: no borra.
 *
 * Borrar la ficha dejaría los envíos que llevó apuntando a una cuenta sin ficha,
 * y la pregunta «quién entregó esto» dejaría de tener respuesta justo cuando
 * alguien la hace. `inactivo` le cierra la puerta y conserva el historial.
 *
 * El rol vuelve a `customer` en la misma operación: mientras siga siendo
 * `courier` sin ficha activa, la persona entra a `/motorizado` y ve una pantalla
 * vacía sin saber por qué.
 */
export async function darDeBajaMotorizado(courierId: string): Promise<ActionResult> {
  await requireAdmin();

  const demo = bloqueadoEnDemostracion();
  if (demo) return demo;

  const supabase = await getSupabaseServerClient();

  const { data: ficha, error: errorFicha } = await supabase
    .from('couriers')
    .select('profile_id, display_name')
    .eq('id', courierId)
    .maybeSingle();

  if (errorFicha) return fromDatabaseError(errorFicha);
  if (!ficha) return failure('Ese motorizado ya no existe.');

  const { count } = await supabase
    .from('shipments')
    .select('id', { count: 'exact', head: true })
    .eq('assigned_to', ficha.profile_id)
    .not('status', 'in', '("entregado","fallido","devuelto")');

  if ((count ?? 0) > 0) {
    return failure(
      `${ficha.display_name} todavía lleva ${count} ${count === 1 ? 'envío' : 'envíos'} encima. ` +
        'Reasígnalos antes de darle de baja, o quedarán sin nadie que los cierre.',
    );
  }

  const problema = checkWrite(
    await supabase.from('couriers').update({ status: 'inactivo' }).eq('id', courierId).select('id'),
  );

  if (problema) return problema;

  await supabase.from('profiles').update({ role: 'customer' }).eq('id', ficha.profile_id);

  revalidatePath('/motorizados');
  return success(`${ficha.display_name} ya no tiene acceso a la aplicación de reparto.`);
}
