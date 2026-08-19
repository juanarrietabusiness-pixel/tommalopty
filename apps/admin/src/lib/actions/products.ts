'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { getSupabaseServerClient } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';
import { failure, fromDatabaseError, fromZodError, success, type ActionResult } from './result';

/**
 * Alta y edición de productos.
 *
 * Se usa el cliente ligado a la sesión: si el rol no puede escribir, RLS lo
 * rechaza en la base de datos aunque alguien llegara hasta aquí.
 */
const productSchema = z.object({
  title: z.string().min(2, 'El título es obligatorio'),
  slug: z
    .string()
    .min(2, 'El slug es obligatorio')
    .regex(/^[a-z0-9-]+$/, 'Solo minúsculas, números y guiones'),
  subtitle: z.string().optional(),
  description: z.string().optional(),
  brand: z.string().optional(),
  status: z.enum(['draft', 'active', 'archived']),
  isFeatured: z.boolean(),
  tags: z.string().optional(),
  price: z.coerce.number().min(0, 'El precio no puede ser negativo'),
  compareAtPrice: z.union([z.coerce.number().min(0), z.literal('')]).optional(),
  sku: z.string().optional(),
  quantity: z.coerce.number().int().min(0, 'El stock no puede ser negativo'),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
});

function parseForm(formData: FormData) {
  return productSchema.safeParse({
    title: formData.get('title'),
    slug: formData.get('slug'),
    subtitle: formData.get('subtitle') || undefined,
    description: formData.get('description') || undefined,
    brand: formData.get('brand') || undefined,
    status: formData.get('status'),
    isFeatured: formData.get('isFeatured') === 'on',
    tags: formData.get('tags') || undefined,
    price: formData.get('price'),
    compareAtPrice: formData.get('compareAtPrice') || '',
    sku: formData.get('sku') || undefined,
    quantity: formData.get('quantity') || 0,
    seoTitle: formData.get('seoTitle') || undefined,
    seoDescription: formData.get('seoDescription') || undefined,
  });
}

function parseTags(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export async function createProduct(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();

  const parsed = parseForm(formData);
  if (!parsed.success) return fromZodError(parsed.error);

  const input = parsed.data;
  const supabase = await getSupabaseServerClient();

  const { data: product, error } = await supabase
    .from('products')
    .insert({
      title: input.title,
      slug: input.slug,
      subtitle: input.subtitle ?? null,
      description: input.description ?? null,
      brand: input.brand ?? null,
      status: input.status,
      is_featured: input.isFeatured,
      tags: parseTags(input.tags),
      seo_title: input.seoTitle ?? null,
      seo_description: input.seoDescription ?? null,
      published_at: input.status === 'active' ? new Date().toISOString() : null,
    })
    .select('id')
    .single();

  if (error || !product) return fromDatabaseError(error ?? { message: 'Error desconocido' });

  // Todo producto nace con una variante por defecto: sin ella no se puede vender.
  const { error: variantError } = await supabase.from('product_variants').insert({
    product_id: product.id,
    title: 'Estándar',
    price: input.price,
    compare_at_price: input.compareAtPrice === '' ? null : Number(input.compareAtPrice),
    sku: input.sku ?? null,
    is_default: true,
  });

  if (variantError) return fromDatabaseError(variantError);

  if (input.quantity > 0) {
    const { data: variant } = await supabase
      .from('product_variants')
      .select('id')
      .eq('product_id', product.id)
      .eq('is_default', true)
      .maybeSingle();

    if (variant) {
      // El trigger `ensure_inventory_row` ya creó la fila; aquí solo se ajusta.
      await supabase
        .from('inventory')
        .update({ quantity: input.quantity })
        .eq('variant_id', variant.id);
    }
  }

  revalidatePath('/catalogo');
  redirect(`/catalogo/${product.id}`);
}

export async function updateProduct(
  productId: string,
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();

  const parsed = parseForm(formData);
  if (!parsed.success) return fromZodError(parsed.error);

  const input = parsed.data;
  const supabase = await getSupabaseServerClient();

  const { error } = await supabase
    .from('products')
    .update({
      title: input.title,
      slug: input.slug,
      subtitle: input.subtitle ?? null,
      description: input.description ?? null,
      brand: input.brand ?? null,
      status: input.status,
      is_featured: input.isFeatured,
      tags: parseTags(input.tags),
      seo_title: input.seoTitle ?? null,
      seo_description: input.seoDescription ?? null,
    })
    .eq('id', productId);

  if (error) return fromDatabaseError(error);

  const { data: variant } = await supabase
    .from('product_variants')
    .select('id')
    .eq('product_id', productId)
    .eq('is_default', true)
    .maybeSingle();

  if (!variant) return failure('El producto no tiene variante por defecto.');

  const { error: variantError } = await supabase
    .from('product_variants')
    .update({
      price: input.price,
      compare_at_price: input.compareAtPrice === '' ? null : Number(input.compareAtPrice),
      sku: input.sku ?? null,
    })
    .eq('id', variant.id);

  if (variantError) return fromDatabaseError(variantError);

  const { error: inventoryError } = await supabase
    .from('inventory')
    .update({ quantity: input.quantity })
    .eq('variant_id', variant.id);

  if (inventoryError) return fromDatabaseError(inventoryError);

  revalidatePath('/catalogo');
  revalidatePath(`/catalogo/${productId}`);
  return success('Producto actualizado.');
}

export async function archiveProduct(productId: string): Promise<void> {
  await requireAdmin();

  const supabase = await getSupabaseServerClient();
  // Archivar en lugar de borrar: los pedidos históricos referencian el producto.
  await supabase.from('products').update({ status: 'archived' }).eq('id', productId);

  revalidatePath('/catalogo');
}
