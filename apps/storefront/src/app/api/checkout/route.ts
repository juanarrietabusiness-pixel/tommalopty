import { NextResponse } from 'next/server';
import { z } from 'zod';
import { payments } from '@nebula/integrations';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { createEventId, sendServerEvent } from '@/lib/tracking';

/**
 * Creación de pedido y arranque del pago.
 *
 * Reglas que no se negocian:
 *  - Los precios SIEMPRE se recalculan en servidor desde la base de datos.
 *    Lo que manda el navegador solo indica qué variante y cuántas unidades.
 *  - El descuento se valida con la función `validate_discount` de Postgres, la
 *    misma que usa el panel: una sola fuente de verdad.
 *  - Se usa el cliente service-role porque el comprador puede ser invitado y no
 *    tiene sesión que RLS pueda autorizar.
 */

const addressSchema = z.object({
  firstName: z.string().min(1, 'Indica el nombre'),
  lastName: z.string().min(1, 'Indica el apellido'),
  line1: z.string().min(1, 'Indica la dirección'),
  line2: z.string().optional(),
  city: z.string().min(1, 'Indica la ciudad'),
  province: z.string().optional(),
  countryCode: z.string().length(2).default('PA'),
  postalCode: z.string().optional(),
  phone: z.string().optional(),
});

const checkoutSchema = z.object({
  email: z.email('Correo electrónico no válido'),
  phone: z.string().optional(),
  shippingAddress: addressSchema,
  shippingMethodId: z.uuid().optional(),
  paymentProvider: z.enum(['paypal', 'wompi', 'paguelofacil', 'yappy']),
  discountCode: z.string().optional(),
  customerNote: z.string().max(500).optional(),
  lines: z
    .array(
      z.object({
        variantId: z.uuid(),
        quantity: z.number().int().positive().max(99),
      }),
    )
    .min(1, 'El carrito está vacío'),
});

export async function POST(request: Request) {
  const parsed = checkoutSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation_failed', issues: z.treeifyError(parsed.error) },
      { status: 400 },
    );
  }

  const input = parsed.data;
  const supabase = getSupabaseServiceClient();

  // Toda la creación del pedido ocurre dentro de `create_order`, una función
  // transaccional de Postgres. Ahí se validan catálogo y stock, se bloquea el
  // inventario, se reservan las unidades, se calculan los totales con los
  // precios reales y se registra el canje del cupón. O se hace todo, o nada:
  // hacerlo desde aquí con varias llamadas REST dejaba pedidos a medias y
  // permitía vender la misma unidad dos veces.
  const { data: created, error: orderError } = await supabase.rpc('create_order', {
    p_email: input.email,
    p_lines: input.lines.map((line) => ({
      variant_id: line.variantId,
      quantity: line.quantity,
    })),
    p_shipping_address: input.shippingAddress,
    p_shipping_method_id: input.shippingMethodId ?? null,
    p_discount_code: input.discountCode ?? null,
    p_phone: input.phone ?? null,
    p_customer_note: input.customerNote ?? null,
    p_first_name: input.shippingAddress.firstName,
    p_last_name: input.shippingAddress.lastName,
  });

  if (orderError) {
    // Los códigos los define `create_order`; se traducen a algo accionable para
    // quien está comprando, sin filtrar detalles internos.
    const mensajes: Record<string, { status: number; error: string; message: string }> = {
      P0001: { status: 400, error: 'empty_cart', message: 'Tu carrito está vacío.' },
      P0002: {
        status: 409,
        error: 'variant_unavailable',
        message: 'Uno de los productos ya no está disponible.',
      },
      P0003: {
        status: 409,
        error: 'insufficient_stock',
        message: 'No queda suficiente stock de uno de los productos.',
      },
      P0004: {
        status: 409,
        error: 'invalid_discount',
        message: 'El código de descuento no es válido o ya se usó.',
      },
      P0005: {
        status: 409,
        error: 'shipping_method_unavailable',
        message: 'El método de envío elegido ya no está disponible.',
      },
    };

    const conocido = mensajes[orderError.code ?? ''];
    if (conocido) {
      return NextResponse.json(
        { error: conocido.error, message: conocido.message },
        { status: conocido.status },
      );
    }

    console.error('[checkout] Error creando el pedido:', orderError);
    return NextResponse.json({ error: 'order_creation_failed' }, { status: 500 });
  }

  const order = created?.[0];
  if (!order) {
    return NextResponse.json({ error: 'order_creation_failed' }, { status: 500 });
  }

  // Señal de inicio de pago para Meta. No se espera: el marketing no debe
  // sumar la latencia de graph.facebook.com a cada compra.
  const eventId = createEventId('checkout');
  void sendServerEvent({
    eventName: 'InitiateCheckout',
    eventId,
    user: {
      email: input.email,
      phone: input.phone,
      firstName: input.shippingAddress.firstName,
      lastName: input.shippingAddress.lastName,
    },
    customData: {
      currency: 'USD',
      value: order.total,
      orderId: order.order_number,
    },
  });

  // Arranque del pago en la pasarela elegida.
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

  try {
    const provider = payments.getProvider(input.paymentProvider);

    if (!provider.isConfigured()) {
      throw new payments.NotImplementedError(provider.id, 'credenciales no configuradas');
    }

    const payment = await provider.createPayment({
      orderId: order.order_id,
      orderNumber: order.order_number,
      amount: { value: order.total, currency: 'USD' },
      customer: {
        email: input.email,
        firstName: input.shippingAddress.firstName,
        lastName: input.shippingAddress.lastName,
        phone: input.phone,
      },
      items: [],
      // El token opaco, no el número de pedido: los números son secuenciales y
      // enumerarlos dejaría leer pedidos ajenos.
      returnUrl: `${siteUrl}/checkout/confirmacion/${order.confirmation_token}`,
      cancelUrl: `${siteUrl}/carrito`,
    });

    await supabase.from('payments').insert({
      order_id: order.order_id,
      provider: input.paymentProvider,
      provider_payment_id: payment.providerPaymentId,
      amount: order.total,
      status: payment.status === 'paid' ? 'paid' : 'pending',
    });

    return NextResponse.json({
      orderNumber: order.order_number,
      confirmationToken: order.confirmation_token,
      redirectUrl: payment.redirectUrl,
      clientPayload: payment.clientPayload,
    });
  } catch (error) {
    // La pasarela aún no está implementada o le faltan credenciales: el pedido
    // queda registrado como pendiente para que el equipo pueda seguirlo desde
    // el panel, y se avisa con claridad en lugar de fingir un pago.
    const isPending = error instanceof payments.NotImplementedError;

    await supabase.from('order_events').insert({
      order_id: order.order_id,
      type: isPending ? 'payment_provider_pending' : 'payment_error',
      message: error instanceof Error ? error.message : 'Error desconocido en la pasarela',
      metadata: { provider: input.paymentProvider },
    });

    if (!isPending) console.error('[checkout] Error de pasarela:', error);

    return NextResponse.json(
      {
        error: isPending ? 'payment_provider_not_ready' : 'payment_failed',
        orderNumber: order.order_number,
        confirmationToken: order.confirmation_token,
        message: isPending
          ? `El pedido ${order.order_number} quedó registrado, pero la pasarela ` +
            `"${input.paymentProvider}" todavía no está conectada.`
          : 'No pudimos iniciar el pago. Inténtalo de nuevo o elige otro método.',
      },
      { status: isPending ? 501 : 502 },
    );
  }
}
