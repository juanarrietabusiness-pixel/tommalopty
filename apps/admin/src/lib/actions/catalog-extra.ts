'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getSupabaseServerClient } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';
import { fromDatabaseError, fromZodError, success, type ActionResult } from './result';

/* --- Categorías ----------------------------------------------------------- */

const categorySchema = z.object({
  name: z.string().min(2, 'El nombre es obligatorio'),
  slug: z
    .string()
    .min(2, 'El slug es obligatorio')
    .regex(/^[a-z0-9-]+$/, 'Solo minúsculas, números y guiones'),
  description: z.string().optional(),
  position: z.coerce.number().int().min(0).default(0),
});

export async function createCategory(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();

  const parsed = categorySchema.safeParse({
    name: formData.get('name'),
    slug: formData.get('slug'),
    description: formData.get('description') || undefined,
    position: formData.get('position') || 0,
  });

  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.from('categories').insert({
    name: parsed.data.name,
    slug: parsed.data.slug,
    description: parsed.data.description ?? null,
    position: parsed.data.position,
  });

  if (error) return fromDatabaseError(error);

  revalidatePath('/catalogo/categorias');
  return success('Categoría creada.');
}

export async function toggleCategory(categoryId: string, isActive: boolean): Promise<void> {
  await requireAdmin();

  const supabase = await getSupabaseServerClient();
  await supabase.from('categories').update({ is_active: isActive }).eq('id', categoryId);

  revalidatePath('/catalogo/categorias');
}

/* --- Inventario ----------------------------------------------------------- */

const inventorySchema = z.object({
  variantId: z.uuid(),
  quantity: z.coerce.number().int().min(0, 'El stock no puede ser negativo'),
  lowStockThreshold: z.coerce.number().int().min(0),
});

export async function updateInventory(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();

  const parsed = inventorySchema.safeParse({
    variantId: formData.get('variantId'),
    quantity: formData.get('quantity'),
    lowStockThreshold: formData.get('lowStockThreshold') || 5,
  });

  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase
    .from('inventory')
    .update({
      quantity: parsed.data.quantity,
      low_stock_threshold: parsed.data.lowStockThreshold,
    })
    .eq('variant_id', parsed.data.variantId);

  if (error) return fromDatabaseError(error);

  revalidatePath('/catalogo/inventario');
  return success('Inventario actualizado.');
}

/* --- Descuentos ----------------------------------------------------------- */

const discountSchema = z.object({
  code: z.string().min(3, 'El código es obligatorio'),
  description: z.string().optional(),
  type: z.enum(['percentage', 'fixed_amount', 'free_shipping']),
  value: z.coerce.number().min(0),
  minSubtotal: z.coerce.number().min(0).default(0),
  usageLimit: z.union([z.coerce.number().int().positive(), z.literal('')]).optional(),
  endsAt: z.string().optional(),
});

export async function createDiscount(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();

  const parsed = discountSchema.safeParse({
    code: formData.get('code'),
    description: formData.get('description') || undefined,
    type: formData.get('type'),
    value: formData.get('value') || 0,
    minSubtotal: formData.get('minSubtotal') || 0,
    usageLimit: formData.get('usageLimit') || '',
    endsAt: formData.get('endsAt') || undefined,
  });

  if (!parsed.success) return fromZodError(parsed.error);

  const input = parsed.data;

  if (input.type === 'percentage' && input.value > 100) {
    return fromZodError(
      new z.ZodError([
        {
          code: 'custom',
          path: ['value'],
          message: 'Un porcentaje no puede superar 100.',
          input: input.value,
        },
      ]),
    );
  }

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.from('discounts').insert({
    code: input.code.toUpperCase(),
    description: input.description ?? null,
    type: input.type,
    value: input.value,
    min_subtotal: input.minSubtotal,
    usage_limit: input.usageLimit === '' ? null : Number(input.usageLimit),
    ends_at: input.endsAt ? new Date(input.endsAt).toISOString() : null,
  });

  if (error) return fromDatabaseError(error);

  revalidatePath('/descuentos');
  return success('Descuento creado.');
}

export async function toggleDiscount(discountId: string, isActive: boolean): Promise<void> {
  await requireAdmin();

  const supabase = await getSupabaseServerClient();
  await supabase.from('discounts').update({ is_active: isActive }).eq('id', discountId);

  revalidatePath('/descuentos');
}
