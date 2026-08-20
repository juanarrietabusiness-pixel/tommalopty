import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { createEventId, sendServerEvent } from '@/lib/tracking';

/**
 * Alta en la newsletter.
 * Guarda el lead en el CRM. El envío al proveedor de email marketing se engancha
 * aquí cuando se conecte la integración.
 */
const schema = z.object({
  email: z.email(),
  source: z.string().max(64).default('newsletter'),
  utm: z.record(z.string(), z.string()).optional(),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_email' }, { status: 400 });
  }

  const { email, source, utm } = parsed.data;

  try {
    const supabase = getSupabaseServiceClient();

    // `leads` tiene índice único (email, source): reintentar no duplica.
    const { error } = await supabase
      .from('leads')
      .upsert({ email, source, utm: utm ?? {} }, { onConflict: 'email,source' });

    if (error) throw error;

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
