import { NextResponse } from 'next/server';
import { z } from 'zod';
import { payments } from '@nebula/integrations';
import type { Json } from '@nebula/db';
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

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

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

  // 1. Precios reales del catálogo (nunca los del cliente).
  const variantIds = input.lines.map((line) => line.variantId);
  const { data: variants, error: variantsError } = await supabase
    .from('product_variants')
    .select('id, title, sku, price, product_id, is_active, products (title), inventory (quantity, reserved_quantity, track_inventory)')
    .in('id', variantIds);

  if (variantsError) {
    console.error('[checkout] Error leyendo variantes:', variantsError);
    return NextResponse.json({ error: 'catalog_unavailable' }, { status: 503 });
  }

  const items: {
    variant_id: string;
    product_id: string;
    product_title: string;
    variant_title: string;
    sku: string | null;
    unit_price: number;
    quantity: number;
    total: number;
  }[] = [];

  for (const line of input.lines) {
    const variant = variants?.find((candidate) => candidate.id === line.variantId);

    if (!variant || !variant.is_active) {
      return NextResponse.json(
        { error: 'variant_unavailable', variantId: line.variantId },
        { status: 409 },
      );
    }

    const inventory = Array.isArray(variant.inventory) ? variant.inventory[0] : variant.inventory;
    const available = (inventory?.quantity ?? 0) - (inventory?.reserved_quantity ?? 0);

    if (inventory?.track_inventory && available < line.quantity) {
      return NextResponse.json(
        { error: 'insufficient_stock', variantId: line.variantId, available },
        { status: 409 },
      );
    }

    const product = Array.isArray(variant.products) ? variant.products[0] : variant.products;

    items.push({
      variant_id: variant.id,
      product_id: variant.product_id,
      product_title: product?.title ?? 'Producto',
      variant_title: variant.title,
      sku: variant.sku,
      unit_price: variant.price,
      quantity: line.quantity,
      total: round(variant.price * line.quantity),
    });
  }

  const subtotal = round(items.reduce((sum, item) => sum + item.total, 0));

  // 2. Descuento validado por la base de datos.
  let discountTotal = 0;
  if (input.discountCode) {
    const { data: validation } = await supabase.rpc('validate_discount', {
      p_code: input.discountCode,
      p_subtotal: subtotal,
    });

    const result = validation?.[0];
    if (!result?.is_valid) {
      return NextResponse.json(
        { error: 'invalid_discount', reason: result?.reason ?? 'Código no válido' },
        { status: 409 },
      );
    }
    discountTotal = round(result.amount);
  }

  // 3. Envío.
  let shippingTotal = 0;
  let shippingMethodSnapshot: Json | null = null;

  if (input.shippingMethodId) {
    const { data: method } = await supabase
      .from('shipping_methods')
      .select('id, name, price, free_above_subtotal')
      .eq('id', input.shippingMethodId)
      .eq('is_active', true)
      .maybeSingle();

    if (!method) {
      return NextResponse.json({ error: 'shipping_method_unavailable' }, { status: 409 });
    }

    const qualifiesForFree =
      method.free_above_subtotal !== null && subtotal - discountTotal >= method.free_above_subtotal;

    shippingTotal = qualifiesForFree ? 0 : method.price;
    shippingMethodSnapshot = { id: method.id, name: method.name, price: shippingTotal };
  }

  const total = round(subtotal - discountTotal + shippingTotal);

  // 4. Ficha de cliente (se crea o se reutiliza por email).
  const { data: customer } = await supabase
    .from('customers')
    .upsert(
      {
        email: input.email,
        first_name: input.shippingAddress.firstName,
        last_name: input.shippingAddress.lastName,
        phone: input.phone ?? input.shippingAddress.phone ?? null,
      },
      { onConflict: 'email', ignoreDuplicates: false },
    )
    .select('id')
    .single();

  // 5. Pedido + líneas.
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      customer_id: customer?.id ?? null,
      email: input.email,
      phone: input.phone ?? null,
      subtotal,
      discount_total: discountTotal,
      shipping_total: shippingTotal,
      total,
      discount_code: input.discountCode ?? null,
      shipping_address: input.shippingAddress,
      shipping_method: shippingMethodSnapshot,
      customer_note: input.customerNote ?? null,
    })
    .select('id, order_number')
    .single();

  if (orderError || !order) {
    console.error('[checkout] Error creando el pedido:', orderError);
    return NextResponse.json({ error: 'order_creation_failed' }, { status: 500 });
  }

  const { error: itemsError } = await supabase.from('order_items').insert(
    items.map((item) => ({ ...item, order_id: order.id })),
  );

  if (itemsError) {
    console.error('[checkout] Error creando las líneas del pedido:', itemsError);
    return NextResponse.json({ error: 'order_items_failed', orderNumber: order.order_number }, { status: 500 });
  }

  // 6. Señal de inicio de pago para Meta (no bloquea el checkout).
  const eventId = createEventId('checkout');
  await sendServerEvent({
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
      value: total,
      orderId: order.order_number,
      contents: items.map((item) => ({
        id: item.sku ?? item.variant_id,
        quantity: item.quantity,
        itemPrice: item.unit_price,
      })),
    },
  });

  // 7. Arranque del pago en la pasarela elegida.
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

  try {
    const provider = payments.getProvider(input.paymentProvider);

    if (!provider.isConfigured()) {
      throw new payments.NotImplementedError(provider.id, 'credenciales no configuradas');
    }

    const payment = await provider.createPayment({
      orderId: order.id,
      orderNumber: order.order_number,
      amount: { value: total, currency: 'USD' },
      customer: {
        email: input.email,
        firstName: input.shippingAddress.firstName,
        lastName: input.shippingAddress.lastName,
        phone: input.phone,
      },
      items: items.map((item) => ({
        name: item.product_title,
        sku: item.sku,
        quantity: item.quantity,
        unitPrice: item.unit_price,
      })),
      returnUrl: `${siteUrl}/checkout/confirmacion/${order.order_number}`,
      cancelUrl: `${siteUrl}/carrito`,
    });

    await supabase.from('payments').insert({
      order_id: order.id,
      provider: input.paymentProvider,
      provider_payment_id: payment.providerPaymentId,
      amount: total,
      status: payment.status === 'paid' ? 'paid' : 'pending',
    });

    return NextResponse.json({
      orderNumber: order.order_number,
      redirectUrl: payment.redirectUrl,
      clientPayload: payment.clientPayload,
    });
  } catch (error) {
    // La pasarela aún no está implementada o le faltan credenciales: el pedido
    // queda registrado como pendiente para que el equipo pueda seguirlo desde
    // el panel, y se avisa con claridad en lugar de fingir un pago.
    const isPending = error instanceof payments.NotImplementedError;

    await supabase.from('order_events').insert({
      order_id: order.id,
      type: isPending ? 'payment_provider_pending' : 'payment_error',
      message: error instanceof Error ? error.message : 'Error desconocido en la pasarela',
      metadata: { provider: input.paymentProvider },
    });

    if (!isPending) console.error('[checkout] Error de pasarela:', error);

    return NextResponse.json(
      {
        error: isPending ? 'payment_provider_not_ready' : 'payment_failed',
        orderNumber: order.order_number,
        message: isPending
          ? `El pedido ${order.order_number} quedó registrado, pero la pasarela ` +
            `"${input.paymentProvider}" todavía no está conectada.`
          : 'No pudimos iniciar el pago. Inténtalo de nuevo o elige otro método.',
      },
      { status: isPending ? 501 : 502 },
    );
  }
}
