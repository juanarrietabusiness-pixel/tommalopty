import { after, NextResponse } from 'next/server';
import { email, payments } from '@nebula/integrations';
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
      .select('id, order_number, email, total, currency, confirmation_token, shipping_address')
      .eq('order_number', verification.orderReference)
      .maybeSingle();

    if (order) {
      // Antes de tocar nada: ¿lo que dice haberse cobrado es lo que vale el
      // pedido? Un pago parcial, un importe manipulado o una divisa distinta
      // entran por esta misma puerta y, sin esta comprobación, salen marcados
      // como pagados.
      const descuadre =
        verification.paymentStatus === 'paid'
          ? payments.descuadreDeImporte(verification.amount, order.total, order.currency)
          : null;

      if (descuadre) {
        // El pedido NO se marca pagado. Se deja constancia en los dos sitios
        // donde alguien va a mirar: el evento y la bitácora del pedido.
        console.error(
          `[webhook:${provider}] Importe descuadrado en ${order.order_number}:`,
          descuadre,
        );

        await supabase
          .from('payment_webhook_events')
          .update({ order_id: order.id, error_message: descuadre })
          .eq('provider', providerId)
          .eq('event_id', eventId);

        await supabase.from('order_events').insert({
          order_id: order.id,
          type: 'payment_amount_mismatch',
          message: descuadre,
          metadata: {
            provider: providerId,
            event_id: eventId,
            esperado: order.total,
            recibido: verification.amount?.value ?? null,
          },
        });

        // 200 a propósito: reintentar el mismo evento da el mismo descuadre, y
        // dejar que la pasarela reintente en bucle no arregla nada. Esto lo
        // resuelve una persona (docs/RUNBOOK.md → "Un pedido se cobró pero no
        // aparece").
        return NextResponse.json({ ok: true, anomaly: 'amount_mismatch' });
      }

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

      // Aviso al cliente. Va en `after()` porque la pasarela espera un 200
      // rápido: si el correo tardara, el proveedor daría el envío por fallido y
      // reintentaría el evento entero.
      if (verification.paymentStatus === 'paid') {
        after(async () => {
          const { data: lineas } = await supabase
            .from('order_items')
            .select('product_title, quantity, total')
            .eq('order_id', order.id);

          const { firstName, lastName } = email.nombreDeDireccion(order.shipping_address);

          const resultado = await email.enviarPagoConfirmado({
            orderNumber: order.order_number,
            email: order.email,
            firstName,
            lastName,
            total: Number(order.total),
            items: (lineas ?? []).map((linea) => ({
              title: linea.product_title,
              quantity: linea.quantity,
              total: Number(linea.total),
            })),
            orderUrl: `${siteUrl()}/checkout/confirmacion/${order.confirmation_token}`,
          });

          if (!resultado.sent && resultado.reason !== 'email_not_configured') {
            console.error(
              `[webhook:${provider}] No se pudo avisar del pago de ${order.order_number}:`,
              resultado.reason,
            );
          }
        });
      }
    }
  }

  return NextResponse.json({ ok: true });
}

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
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
