import { NextResponse } from 'next/server';
import { z } from 'zod';
import { computeOrderTotals } from '@nebula/domain';
import { getSupabaseServiceClient, isSupabaseConfigured } from '@/lib/supabase';

/**
 * Cotización del pedido antes de confirmarlo.
 *
 * Existe porque el navegador NO puede calcular el total: no conoce los precios
 * reales del catálogo, no sabe cuánto descuenta un cupón y no puede decidir si
 * el envío es gratis. Cuando lo intentaba, la pantalla mostraba un importe y la
 * pasarela cobraba otro — el umbral de envío gratis se evaluaba antes del
 * descuento en el cliente y después en el servidor.
 *
 * Este endpoint devuelve exactamente los mismos números que después cobrará
 * `create_order`, calculados con la misma función de dominio.
 */
const cotizarSchema = z.object({
  lines: z
    .array(
      z.object({
        variantId: z.uuid(),
        quantity: z.number().int().positive().max(99),
      }),
    )
    .max(100),
  shippingMethodId: z.uuid().optional(),
  discountCode: z.string().max(64).optional(),
});

export interface Cotizacion {
  subtotal: number;
  discountTotal: number;
  shippingTotal: number;
  total: number;
  /** null si no se envió código; si se envió, dice si sirve y por qué no. */
  discount: { code: string; applied: boolean; reason: string | null } | null;
}

export async function POST(request: Request) {
  const parsed = cotizarSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: 'validation_failed' }, { status: 400 });
  }

  const input = parsed.data;

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'store_not_configured' }, { status: 503 });
  }

  if (input.lines.length === 0) {
    const vacio: Cotizacion = {
      subtotal: 0,
      discountTotal: 0,
      shippingTotal: 0,
      total: 0,
      discount: null,
    };
    return NextResponse.json(vacio);
  }

  const supabase = getSupabaseServiceClient();

  // Se agrupan las líneas repetidas igual que hace `create_order`, para que la
  // cotización no difiera del cobro cuando alguien añade la misma variante dos veces.
  const cantidades = new Map<string, number>();
  for (const line of input.lines) {
    cantidades.set(line.variantId, (cantidades.get(line.variantId) ?? 0) + line.quantity);
  }

  const { data: variants, error: variantsError } = await supabase
    .from('product_variants')
    .select('id, price, is_active, products (status)')
    .in('id', [...cantidades.keys()]);

  if (variantsError) {
    console.error('[cotizar] Error leyendo variantes:', variantsError);
    return NextResponse.json({ error: 'catalog_unavailable' }, { status: 503 });
  }

  const pricedLines: { unitPrice: number; quantity: number }[] = [];

  for (const [variantId, quantity] of cantidades) {
    const variant = variants?.find((candidate) => candidate.id === variantId);
    const product = Array.isArray(variant?.products) ? variant?.products[0] : variant?.products;

    // Una variante retirada del catálogo no suma al total; el checkout la
    // rechazará explícitamente al confirmar.
    if (!variant?.is_active || product?.status !== 'active') continue;

    pricedLines.push({ unitPrice: variant.price, quantity });
  }

  const subtotal = computeOrderTotals({ lines: pricedLines }).subtotal;

  // El descuento lo valida la base de datos, con la misma función que el cobro.
  let discount: Cotizacion['discount'] = null;
  let discountInput: {
    type: 'percentage' | 'fixed_amount' | 'free_shipping';
    amount: number;
  } | null = null;

  if (input.discountCode && input.discountCode.trim().length > 0) {
    const { data: validation } = await supabase.rpc('validate_discount', {
      p_code: input.discountCode.trim(),
      p_subtotal: subtotal,
    });

    const result = validation?.[0];
    if (result?.is_valid) {
      discountInput = { type: result.type ?? 'fixed_amount', amount: result.amount };
      discount = { code: input.discountCode.trim(), applied: true, reason: null };
    } else {
      discount = {
        code: input.discountCode.trim(),
        applied: false,
        reason: result?.reason ?? 'El código no es válido.',
      };
    }
  }

  let shipping: { price: number; freeAboveSubtotal: number | null } | null = null;
  if (input.shippingMethodId) {
    const { data: method } = await supabase
      .from('shipping_methods')
      .select('price, free_above_subtotal')
      .eq('id', input.shippingMethodId)
      .eq('is_active', true)
      .maybeSingle();

    if (method) {
      shipping = { price: method.price, freeAboveSubtotal: method.free_above_subtotal };
    }
  }

  const totals = computeOrderTotals({ lines: pricedLines, discount: discountInput, shipping });

  const cotizacion: Cotizacion = {
    subtotal: totals.subtotal,
    discountTotal: totals.discountTotal,
    shippingTotal: totals.shippingTotal,
    total: totals.total,
    discount,
  };

  return NextResponse.json(cotizacion);
}
