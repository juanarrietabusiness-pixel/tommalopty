import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  ESTADOS_DESDE_LA_CALLE,
  isShipmentStatus,
  validateShipmentTransition,
} from '@nebula/domain';
import { getSupabaseServiceClient, isSupabaseConfigured } from '@/lib/supabase';

/**
 * Lo que envía la página del QR cuando quien entrega marca el resultado.
 *
 * EL TOKEN ES EL PERMISO
 *
 * No hay sesión: quien entrega no tiene cuenta, y pedirle que inicie sesión con
 * el casco puesto es pedirle que llame por teléfono en su lugar. La llave es el
 * token impreso en la guía que ya lleva encima, y son 24 bytes aleatorios: no
 * hay siguiente que probar.
 *
 * Lo que eso obliga a hacer aquí:
 *
 *  - Solo se aceptan los dos estados que le tocan. Aunque alguien mande otro,
 *    no pasa de esta comprobación: la lista está en el dominio y es la misma
 *    que dibuja los botones.
 *  - El estado actual se lee de la base, nunca del cuerpo de la petición. Si
 *    se aceptara «desde qué estado vengo», bastaría mentir para saltarse la
 *    máquina.
 *  - La transición se valida dos veces: aquí, para poder devolver un mensaje
 *    entendible, y en el disparador de Postgres, que es el que de verdad no se
 *    puede saltar.
 */

const cuerpoSchema = z.object({
  status: z.enum(ESTADOS_DESDE_LA_CALLE),
  receivedBy: z.string().trim().max(80).optional(),
  failureReason: z.string().trim().max(200).optional(),
});

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;

  if (!/^[a-f0-9]{48}$/.test(token)) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  }

  const parsed = cuerpoSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation_failed', message: 'Esa acción no es válida desde aquí.' },
      { status: 400 },
    );
  }

  const supabase = getSupabaseServiceClient();

  const { data: envio } = await supabase
    .from('shipments')
    .select('id, status, tracking_number')
    .eq('token', token)
    .maybeSingle();

  if (!envio) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const actual = isShipmentStatus(envio.status) ? envio.status : 'pendiente';
  const problema = validateShipmentTransition(actual, parsed.data.status);

  if (problema) {
    return NextResponse.json(
      { error: 'invalid_transition', message: problema.message },
      { status: 409 },
    );
  }

  const { error } = await supabase
    .from('shipments')
    .update({
      status: parsed.data.status,
      received_by: parsed.data.receivedBy ?? null,
      failure_reason: parsed.data.failureReason ?? null,
    })
    .eq('id', envio.id);

  if (error) {
    // El 23514 es el disparador de Postgres rechazando la transición. Que
    // llegue aquí significa que el estado cambió entre la lectura de arriba y
    // esta escritura — dos personas tocando el mismo envío a la vez.
    if (error.code === '23514') {
      return NextResponse.json(
        {
          error: 'invalid_transition',
          message: 'Alguien acaba de cambiar este envío. Recarga la página para ver cómo quedó.',
        },
        { status: 409 },
      );
    }

    console.error('[entrega] No se pudo marcar el envío:', error);
    return NextResponse.json({ error: 'update_failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, status: parsed.data.status });
}
