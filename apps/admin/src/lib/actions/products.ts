'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { getSupabaseServerClient } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';
import {
  checkWrite,
  failure,
  fromDatabaseError,
  fromZodError,
  success,
  type ActionResult,
  bloqueadoEnDemostracion,
} from './result';

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

  const demo = bloqueadoEnDemostracion();
  if (demo) return demo;

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
      const problemaStock = checkWrite(
        await supabase
          .from('inventory')
          .update({ quantity: input.quantity })
          .eq('variant_id', variant.id)
          .select('variant_id'),
        'El producto se creó, pero no se pudo fijar el stock inicial.',
      );

      if (problemaStock) return problemaStock;
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

  const demo = bloqueadoEnDemostracion();
  if (demo) return demo;

  const parsed = parseForm(formData);
  if (!parsed.success) return fromZodError(parsed.error);

  const input = parsed.data;
  const supabase = await getSupabaseServerClient();

  const { data: previo } = await supabase
    .from('products')
    .select('published_at')
    .eq('id', productId)
    .maybeSingle();

  if (!previo) return failure('El producto ya no existe.');

  const problemaProducto = checkWrite(
    await supabase
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
        // Al publicar hay que fijar la fecha: el catálogo ordena por ella, así
        // que sin esto un producto recién publicado queda al final para siempre.
        ...(input.status === 'active' && !previo.published_at
          ? { published_at: new Date().toISOString() }
          : {}),
      })
      .eq('id', productId)
      .select('id'),
  );

  if (problemaProducto) return problemaProducto;

  const { data: variant } = await supabase
    .from('product_variants')
    .select('id')
    .eq('product_id', productId)
    .eq('is_default', true)
    .maybeSingle();

  if (!variant) return failure('El producto no tiene variante por defecto.');

  const problemaVariante = checkWrite(
    await supabase
      .from('product_variants')
      .update({
        price: input.price,
        compare_at_price: input.compareAtPrice === '' ? null : Number(input.compareAtPrice),
        sku: input.sku ?? null,
      })
      .eq('id', variant.id)
      .select('id'),
  );

  if (problemaVariante) return problemaVariante;

  const problemaInventario = checkWrite(
    await supabase
      .from('inventory')
      .update({ quantity: input.quantity })
      .eq('variant_id', variant.id)
      .select('variant_id'),
  );

  if (problemaInventario) return problemaInventario;

  revalidatePath('/catalogo');
  revalidatePath(`/catalogo/${productId}`);
  return success('Producto actualizado.');
}

export async function archiveProduct(productId: string): Promise<ActionResult> {
  await requireAdmin();

  const demo = bloqueadoEnDemostracion();
  if (demo) return demo;

  const supabase = await getSupabaseServerClient();
  // Archivar en lugar de borrar: los pedidos históricos referencian el producto.
  const problema = checkWrite(
    await supabase.from('products').update({ status: 'archived' }).eq('id', productId).select('id'),
  );

  if (problema) return problema;

  revalidatePath('/catalogo');
  return success('Producto archivado.');
}

/* --- Imágenes de producto -------------------------------------------------- */

/**
 * Registra una imagen ya subida al almacenamiento.
 *
 * La subida ocurre antes, en `/api/media`, que es quien valida el fichero y
 * devuelve la URL. Aquí solo se guarda la referencia, así que la URL se
 * comprueba contra el dominio configurado: si no viniera de ahí, el panel
 * estaría dejando que alguien enganche cualquier dirección de internet como
 * imagen de un producto.
 */
export async function addProductImage(input: {
  productId: string;
  url: string;
  alt: string;
}): Promise<ActionResult> {
  await requireAdmin();

  const demo = bloqueadoEnDemostracion();
  if (demo) return demo;

  const publicBase = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;

  if (!publicBase || !input.url.startsWith(publicBase.replace(/\/+$/, ''))) {
    return failure('Esa imagen no viene del almacenamiento de la tienda.');
  }

  const supabase = await getSupabaseServerClient();

  const { data: existing, error: readError } = await supabase
    .from('product_images')
    .select('id, position')
    .eq('product_id', input.productId)
    .order('position', { ascending: false })
    .limit(1);

  if (readError) return fromDatabaseError(readError);

  const last = existing?.[0];

  const { error } = await supabase.from('product_images').insert({
    product_id: input.productId,
    url: input.url,
    alt: input.alt.trim() || null,
    position: last ? last.position + 1 : 0,
    // La primera imagen que se sube es la principal: si no, un producto con
    // fotos seguiría saliendo sin foto en el catálogo hasta que alguien se
    // acordara de marcarla.
    is_primary: !last,
  });

  if (error) return fromDatabaseError(error);

  revalidatePath(`/catalogo/${input.productId}`);
  return success('Imagen añadida.');
}

export async function deleteProductImage(
  productId: string,
  imageId: string,
): Promise<ActionResult> {
  await requireAdmin();

  const demo = bloqueadoEnDemostracion();
  if (demo) return demo;

  const supabase = await getSupabaseServerClient();

  const { data: imagen, error: readError } = await supabase
    .from('product_images')
    .select('id, is_primary')
    .eq('id', imageId)
    .eq('product_id', productId)
    .maybeSingle();

  if (readError) return fromDatabaseError(readError);
  if (!imagen) return failure('Esa imagen ya no existe.');

  const problema = checkWrite(
    await supabase
      .from('product_images')
      .delete()
      .eq('id', imageId)
      .eq('product_id', productId)
      .select('id'),
    'No se borró la imagen: tu rol no tiene permiso.',
  );

  if (problema) return problema;

  // Al borrar la principal, la siguiente pasa a serlo. Sin esto el producto se
  // queda sin imagen principal y el catálogo lo pinta sin foto teniéndolas.
  if (imagen.is_primary) {
    const { data: siguiente } = await supabase
      .from('product_images')
      .select('id')
      .eq('product_id', productId)
      .order('position')
      .limit(1);

    const heredera = siguiente?.[0];
    if (heredera) {
      await supabase.from('product_images').update({ is_primary: true }).eq('id', heredera.id);
    }
  }

  revalidatePath(`/catalogo/${productId}`);
  return success('Imagen eliminada.');
}

/**
 * Marca una imagen como principal.
 *
 * Se quita primero la marca a las demás porque hay un índice único parcial
 * (`product_images_primary_key`) que solo admite una principal por producto: en
 * el orden contrario, la escritura choca contra el índice y falla.
 */
export async function setPrimaryProductImage(
  productId: string,
  imageId: string,
): Promise<ActionResult> {
  await requireAdmin();

  const demo = bloqueadoEnDemostracion();
  if (demo) return demo;

  const supabase = await getSupabaseServerClient();

  const { error: clearError } = await supabase
    .from('product_images')
    .update({ is_primary: false })
    .eq('product_id', productId)
    .eq('is_primary', true);

  if (clearError) return fromDatabaseError(clearError);

  const problema = checkWrite(
    await supabase
      .from('product_images')
      .update({ is_primary: true })
      .eq('id', imageId)
      .eq('product_id', productId)
      .select('id'),
    'No se pudo marcar como principal: tu rol no tiene permiso, o la imagen ya no existe.',
  );

  if (problema) return problema;

  revalidatePath(`/catalogo/${productId}`);
  return success('Imagen principal actualizada.');
}
