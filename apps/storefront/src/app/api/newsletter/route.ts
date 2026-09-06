import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { createEventId, sendServerEvent } from '@/lib/tracking';

/**
 * Alta en la newsletter.
 *
 * Esta ruta es ahora **la única puerta** a `leads` (#9). Antes no lo era: `anon`
 * tenía privilegio INSERT sobre la tabla y la política lo permitía con
 * `check (true)`, así que cualquiera con la clave publicable —que va en el
 * navegador, por diseño— podía escribir sin pasar por aquí. Un límite de tasa
 * delante de una puerta, con la otra abierta, no es un límite.
 *
 * Con el privilegio revocado, lo de abajo empieza a significar algo.
 */
const schema = z.object({
  email: z.email(),
  source: z.string().max(64).default('newsletter'),
  utm: z.record(z.string(), z.string()).optional(),
  /**
   * Trampa para bots: un campo que la persona no ve y no rellena nunca.
   *
   * No es una defensa fuerte —un bot dirigido la esquiva— pero para el ruido
   * automático de fondo es lo más barato que existe: cero fricción para quien
   * se suscribe de verdad, cero dependencias, y no hace falta que nadie
   * resuelva un captcha para dejar su correo.
   */
  website: z.string().max(200).optional(),
});

/**
 * La IP de quien pide, según Cloudflare.
 *
 * `cf-connecting-ip` la pone el propio Cloudflare y no se puede falsificar desde
 * fuera. `x-forwarded-for` sí —cualquiera puede mandarla—, así que solo se usa
 * como respaldo y quedándose con el primer salto.
 */
function ipDeLaPeticion(request: Request): string {
  const cloudflare = request.headers.get('cf-connecting-ip');
  if (cloudflare) return cloudflare;

  const reenviada = request.headers.get('x-forwarded-for');
  return reenviada?.split(',')[0]?.trim() ?? '';
}

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_email' }, { status: 400 });
  }

  const { email, source, utm, website } = parsed.data;

  // La trampa respondida: se contesta que sí y no se guarda nada. Decirle al bot
  // que lo hemos pillado solo le enseña a no caer la próxima vez.
  if (website && website.length > 0) {
    return NextResponse.json({ ok: true });
  }

  try {
    const supabase = getSupabaseServiceClient();

    // El límite vive en Postgres y no aquí: la tienda corre en Workers, donde
    // cada petición puede caer en un aislado distinto y un contador en memoria
    // empezaría de cero cada dos por tres. La base es el único estado compartido.
    //
    // La IP viaja en claro hasta la función, que la hashea con una sal que no
    // sale de la base y guarda solo el hash. La IP no se almacena en ninguna parte.
    const { data: registrado, error } = await supabase.rpc('registrar_lead', {
      p_email: email,
      p_source: source,
      p_utm: utm ?? {},
      p_ip: ipDeLaPeticion(request),
    });

    if (error) throw error;

    if (!registrado) {
      return NextResponse.json({ error: 'demasiados_intentos' }, { status: 429 });
    }

    await sendServerEvent({
      eventName: 'Lead',
      eventId: createEventId('lead'),
      user: { email },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[newsletter] Error registrando el lead:', error);
    return NextResponse.json({ error: 'subscription_failed' }, { status: 500 });
  }
}
