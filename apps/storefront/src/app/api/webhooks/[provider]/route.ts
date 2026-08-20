import { NextResponse } from 'next/server';
import { payments } from '@nebula/integrations';
import type { Json } from '@nebula/db';
import { getSupabaseServiceClient } from '@/lib/supabase';

/**
 * Webhooks de las pasarelas de pago.
 *
 * Es la única fuente de verdad del estado de un pago: nunca se marca un pedido
 * como pagado desde la vuelta del navegador, que es manipulable.
 *
 * Garantías:
 *  - La firma se verifica en el adaptador de cada pasarela.
 *  - Cada evento se registra en `payment_webhook_events` con índice único
 *    (provider, event_id): un reintento del proveedor no reprocesa nada.
 *  - Se responde 200 incluso ante eventos ya procesados, para que la pasarela
 *    deje de reintentar.
 */
const VALID_PROVIDERS = new Set(['paypal', 'wompi', 'paguelofacil', 'yappy']);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;

  if (!VALID_PROVIDERS.has(provider)) {
    return NextResponse.json({ error: 'unknown_provider' }, { status: 404 });
  }

  const body = await request.text();
  const headerEntries: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headerEntries[key.toLowerCase()] = value;
  });

  const supabase = getSupabaseServiceClient();
  const providerId = provider as payments.PaymentProviderId;

  let verification: payments.WebhookVerification;
  try {
    verification = await payments.getProvider(providerId).verifyWebhook({
      body,
      headers: headerEntries,
    });
  } catch (error) {
    // Adaptador aún sin implementar: se deja constancia del evento para poder
    // reprocesarlo cuando la integración esté lista.
    await supabase.from('payment_webhook_events').insert({
      provider: providerId,
      event_id: `unverified-${crypto.randomUUID()}`,
      signature_valid: false,
      payload: safeParse(body),
      error_message: error instanceof Error ? error.message : 'verificación no implementada',
    });

    return NextResponse.json({ error: 'webhook_verification_unavailable' }, { status: 501 });
  }

  if (!verification.isValid) {
    console.warn(`[webhook:${provider}] Firma inválida`);
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 });
  }

  const eventId = verification.eventId ?? crypto.randomUUID();

  // El índice único hace de cerrojo de idempotencia.
  const { error: insertError } = await supabase.from('payment_webhook_events').insert({
    provider: providerId,
    event_id: eventId,
    event_type: verification.eventType,
    signature_valid: true,
    payload: safeParse(body),
  });

  if (insertError) {
    if (insertError.code === '23505') {
      return NextResponse.json({ ok: true, alreadyProcessed: true });
    }
    console.error(`[webhook:${provider}] Error registrando el evento:`, insertError);
    return NextResponse.json({ error: 'event_storage_failed' }, { status: 500 });
  }

  if (verification.paymentStatus && verification.orderReference) {
    const { data: order } = await supabase
      .from('orders')
      .select('id')
      .eq('order_number', verification.orderReference)
      .maybeSingle();

    if (order) {
      await supabase
        .from('orders')
        .update({
          payment_status: verification.paymentStatus,
          status: verification.paymentStatus === 'paid' ? 'confirmed' : undefined,
          placed_at: verification.paymentStatus === 'paid' ? new Date().toISOString() : undefined,
        })
        .eq('id', order.id);

      if (verification.providerPaymentId) {
        await supabase
          .from('payments')
          .update({ status: verification.paymentStatus, processed_at: new Date().toISOString() })
          .eq('order_id', order.id)
          .eq('provider', providerId);
      }

      await supabase
        .from('payment_webhook_events')
        .update({ order_id: order.id, processed_at: new Date().toISOString() })
        .eq('provider', providerId)
        .eq('event_id', eventId);
    }
  }

  return NextResponse.json({ ok: true });
}

function safeParse(body: string): Json {
  try {
    const parsed: unknown = JSON.parse(body);
    return typeof parsed === 'object' && parsed !== null ? (parsed as Json) : {};
  } catch {
    // Cuerpo no-JSON (algunas pasarelas envían form-urlencoded): se guarda
    // recortado para poder depurar sin llenar la tabla.
    return { raw: body.slice(0, 2000) };
  }
}
