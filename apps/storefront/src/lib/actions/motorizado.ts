'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import {
  ESTADOS_DEL_MOTORIZADO,
  validateShipmentTransition,
  isShipmentStatus,
} from '@nebula/domain';
import { storage } from '@nebula/integrations';
import { getSupabaseServerClient, isSupabaseConfigured } from '@/lib/supabase';
import { getBucketPrivado } from '@/lib/media-privada';

/**
 * Mover un envío desde la aplicación del motorizado.
 *
 * TRES CANDADOS PARA LO MISMO, Y NINGUNO SOBRA
 *
 *  1. **Aquí**, para dar un mensaje entendible antes de tocar la base.
 *  2. **La política RLS**, que solo deja actualizar los envíos asignados a quien
 *     consulta. Es la que hace que pedir el de otro no haga nada.
 *  3. **`guard_courier_shipment_update`**, el disparador, que además impide
 *     cambiar cualquier columna que no sea el estado o la prueba de entrega.
 *
 * El primero se puede saltar cualquiera que llame a la API por su cuenta. Los
 * otros dos, no. Por eso el mensaje bonito vive aquí y la seguridad vive allí.
 *
 * NO SE USA LA CLAVE DE SERVICIO
 *
 * A diferencia de la página del QR —que es anónima y se sirve con service-role
 * filtrando por token—, aquí hay sesión. Usar la clave de servicio se saltaría
 * RLS y convertiría el «solo mis envíos» en una comprobación que habría que
 * escribir a mano en esta función, que es justo donde se olvida.
 */

export interface ResultadoDeEntrega {
  ok: boolean;
  mensaje: string;
}

const cierreSchema = z.object({
  shipmentId: z.uuid(),
  status: z.enum(ESTADOS_DEL_MOTORIZADO),
  receivedBy: z.string().trim().max(120).optional(),
  deliveryNote: z.string().trim().max(300).optional(),
  failureReason: z.string().trim().max(300).optional(),
});

export async function moverMiEnvio(entrada: {
  shipmentId: string;
  status: string;
  receivedBy?: string;
  deliveryNote?: string;
  failureReason?: string;
}): Promise<ResultadoDeEntrega> {
  if (!isSupabaseConfigured()) {
    return { ok: false, mensaje: 'La tienda no está conectada a su base de datos.' };
  }

  const parsed = cierreSchema.safeParse(entrada);
  if (!parsed.success) {
    return { ok: false, mensaje: 'Esa acción no es válida para un envío.' };
  }

  const datos = parsed.data;
  const supabase = await getSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, mensaje: 'Se cerró tu sesión. Vuelve a entrar.' };

  // Se lee antes para poder validar la transición y decir por qué no se puede.
  // La lectura ya pasa por RLS: si el envío no es suyo, aquí no llega nada.
  const { data: actual } = await supabase
    .from('shipments')
    .select('id, status')
    .eq('id', datos.shipmentId)
    .maybeSingle();

  if (!actual) {
    return { ok: false, mensaje: 'Ese envío ya no está asignado a ti.' };
  }

  if (isShipmentStatus(actual.status)) {
    const problema = validateShipmentTransition(actual.status, datos.status);
    if (problema) return { ok: false, mensaje: problema.message };
  }

  const { error } = await supabase
    .from('shipments')
    .update({
      status: datos.status,
      // Solo se escribe lo que corresponde al desenlace. Mandar el motivo del
      // fallo en una entrega correcta dejaría en la ficha un texto que
      // contradice el estado.
      ...(datos.status === 'entregado'
        ? { received_by: datos.receivedBy ?? null, delivery_note: datos.deliveryNote ?? null }
        : {}),
      ...(datos.status === 'fallido' ? { failure_reason: datos.failureReason ?? null } : {}),
    })
    .eq('id', datos.shipmentId);

  if (error) {
    // 42501 es el disparador o la política rechazando: no es un fallo técnico,
    // es que la acción no le corresponde a quien la pidió.
    if (error.code === '42501') {
      return { ok: false, mensaje: 'Esa acción no te corresponde a ti.' };
    }
    console.error('[motorizado] No se pudo mover el envío:', error);
    return { ok: false, mensaje: 'No se pudo guardar. Revisa tu señal e inténtalo otra vez.' };
  }

  revalidatePath('/motorizado');
  revalidatePath(`/motorizado/${datos.shipmentId}`);

  return {
    ok: true,
    mensaje:
      datos.status === 'entregado'
        ? 'Entrega cerrada. Gracias.'
        : datos.status === 'fallido'
          ? 'Anotado. Quien despacha lo verá.'
          : 'Listo.',
  };
}

/**
 * La foto de la prueba de entrega.
 *
 * VA A UN BUCKET PRIVADO, Y NO ES UN DETALLE DE CONFIGURACIÓN
 *
 * Es la puerta de casa de alguien, a veces con la persona en el encuadre. En el
 * bucket público de las imágenes de catálogo, cualquiera con la URL la vería
 * para siempre — y las URL se reenvían. Aquí se guarda la **clave** del objeto
 * en la fila del envío, y esa clave no llega nunca al navegador: para ver la
 * foto hay que pedir el envío por una ruta que comprueba permisos.
 *
 * SE SUBE ANTES DE CERRAR LA ENTREGA
 *
 * Y en ese orden a propósito. Si la subida falla, quien reparte **todavía está
 * en la puerta** y puede repetirla o cerrar sin foto. Al revés —cerrar primero—
 * la pantalla ya habría vuelto a la lista y la foto se perdería con la moto en
 * marcha.
 *
 * De quién es el envío no se comprueba aquí: se lee con el cliente de sesión,
 * así que si no es suyo no hay fila, y sin fila no hay subida. La misma política
 * que decide todo lo demás.
 */
export async function subirPruebaDeEntrega(formData: FormData): Promise<ResultadoDeEntrega> {
  if (!isSupabaseConfigured()) {
    return { ok: false, mensaje: 'La tienda no está conectada a su base de datos.' };
  }

  const shipmentId = String(formData.get('shipmentId') ?? '');
  if (!z.uuid().safeParse(shipmentId).success) {
    return { ok: false, mensaje: 'No sabemos de qué entrega es esa foto.' };
  }

  const fichero = formData.get('foto');
  if (!(fichero instanceof File) || fichero.size === 0) {
    return { ok: false, mensaje: 'No llegó ninguna foto.' };
  }

  const supabase = await getSupabaseServerClient();

  const { data: envio } = await supabase
    .from('shipments')
    .select('id')
    .eq('id', shipmentId)
    .maybeSingle();

  if (!envio) return { ok: false, mensaje: 'Esa entrega ya no está asignada a ti.' };

  const bucket = getBucketPrivado();
  if (!bucket) {
    return {
      ok: false,
      mensaje:
        'No hay almacenamiento conectado, así que la foto no se puede guardar. ' +
        'Puedes cerrar la entrega igual y anotarlo en la nota.',
    };
  }

  const buffer = await fichero.arrayBuffer();

  // Lo que decide qué es el fichero son sus bytes, no lo que diga el teléfono.
  const comprobado = storage.comprobarSubidaPrivada({
    declaredType: fichero.type,
    size: fichero.size,
    bytes: new Uint8Array(buffer),
  });

  if (!comprobado.ok) return { ok: false, mensaje: comprobado.reason };

  const clave = storage.construirClavePrivada({
    tipo: 'entrega',
    duenoId: shipmentId,
    extension: comprobado.extension,
    id: crypto.randomUUID(),
  });

  try {
    await bucket.put(clave, buffer, {
      httpMetadata: {
        contentType: comprobado.type,
        // Nada de caché: quien la mire la pide cada vez y no se queda por el
        // camino en ningún proxy.
        cacheControl: 'private, no-store',
      },
    });
  } catch (error) {
    console.error('[motorizado] no se pudo guardar la prueba de entrega', error);
    return {
      ok: false,
      mensaje: 'No se pudo subir la foto. Revisa tu señal e inténtalo otra vez.',
    };
  }

  const { error } = await supabase
    .from('shipments')
    .update({ delivery_proof_key: clave })
    .eq('id', shipmentId);

  if (error) {
    // El objeto ya está en el bucket pero la fila no lo sabe. Se borra: dejarlo
    // sería una foto de la casa de alguien sin nada que la referencie, y por
    // tanto sin nada que la borre nunca.
    await bucket.delete(clave).catch(() => undefined);

    if (error.code === '42501') {
      return { ok: false, mensaje: 'Esa entrega no te corresponde a ti.' };
    }

    console.error('[motorizado] no se pudo apuntar la prueba de entrega', error);
    return { ok: false, mensaje: 'La foto se subió pero no se pudo guardar. Inténtalo otra vez.' };
  }

  revalidatePath(`/motorizado/${shipmentId}`);

  return { ok: true, mensaje: 'Foto guardada.' };
}
