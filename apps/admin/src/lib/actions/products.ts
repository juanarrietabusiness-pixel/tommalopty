'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import {
  findDuplicateSkus,
  normalizeSku,
  validateVariant,
  type VariantValidationError,
} from '@nebula/domain';
import { getSupabaseServerClient } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';
import { deleteMediaByUrl } from '@/lib/storage';
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
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
});

/**
 * El alta lleva además el precio y el stock de la primera variante.
 *
 * La edición no: desde que existe la sección de Variantes, precio, SKU y stock
 * los gobierna ella. Tenerlos también aquí significaba dos formularios
 * escribiendo la misma fila con validaciones distintas —este esquema no
 * comprueba que el precio tachado sea mayor que el de venta, y
 * `validateVariant` sí—, así que el resultado dependía de por dónde entrases.
 */
const nuevoProductoSchema = productSchema.extend({
  price: z.coerce.number().min(0, 'El precio no puede ser negativo'),
  compareAtPrice: z.union([z.coerce.number().min(0), z.literal('')]).optional(),
  sku: z.string().optional(),
  quantity: z.coerce.number().int().min(0, 'El stock no puede ser negativo'),
});

function camposComunes(formData: FormData) {
  return {
    title: formData.get('title'),
    slug: formData.get('slug'),
    subtitle: formData.get('subtitle') || undefined,
    description: formData.get('description') || undefined,
    brand: formData.get('brand') || undefined,
    status: formData.get('status'),
    isFeatured: formData.get('isFeatured') === 'on',
    tags: formData.get('tags') || undefined,
    seoTitle: formData.get('seoTitle') || undefined,
    seoDescription: formData.get('seoDescription') || undefined,
  };
}

function parseNuevoProducto(formData: FormData) {
  return nuevoProductoSchema.safeParse({
    ...camposComunes(formData),
    price: formData.get('price'),
    compareAtPrice: formData.get('compareAtPrice') || '',
    sku: formData.get('sku') || undefined,
    quantity: formData.get('quantity') || 0,
  });
}

function parseProducto(formData: FormData) {
  return productSchema.safeParse(camposComunes(formData));
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

  const parsed = parseNuevoProducto(formData);
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

  const parsed = parseProducto(formData);
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

  // Precio, SKU y stock ya no se tocan aquí: los gobierna la sección de
  // Variantes, que es la única que sabe que un producto puede tener más de una.

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

  // Se lee la `url` ANTES de borrar la fila: es lo único que apunta al objeto
  // en R2, y después de borrarla ya no hay forma de saber qué fichero era.
  const { data: imagen, error: readError } = await supabase
    .from('product_images')
    .select('id, is_primary, url')
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

  // Y ahora el fichero. Después de la fila y no antes, por la misma razón que
  // en `borrarAbono`: si falla esto queda un huérfano en el bucket, molesto
  // pero invisible; al revés quedaría una imagen rota en el catálogo.
  //
  // No se propaga el fallo a quien borró: la imagen ya no está en el catálogo,
  // que es lo que pidió. Lo que no puede es quedarse callado, y por eso
  // `deleteMediaByUrl` lo deja en el log.
  await deleteMediaByUrl(imagen.url);

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

/* --- Variantes ------------------------------------------------------------- */

/**
 * Alta y edición de variantes.
 *
 * Hasta ahora el panel solo tocaba la variante por defecto, así que un producto
 * con tallas o colores no se podía vender: la tienda ya sabía pintar el
 * selector, pero no había forma de crear la segunda variante sin SQL.
 *
 * Las reglas de precio viven en `@nebula/domain` porque son reglas de dinero, y
 * en este proyecto esas se prueban al 100 %.
 */

interface VariantInput {
  title: string;
  sku: string;
  price: number;
  compareAtPrice: number | null;
}

function leerVariante(formData: FormData): VariantInput {
  const compare = String(formData.get('compareAtPrice') ?? '').trim();

  return {
    title: String(formData.get('title') ?? ''),
    sku: String(formData.get('sku') ?? ''),
    price: Number(String(formData.get('price') ?? '').trim()),
    compareAtPrice: compare === '' ? null : Number(compare),
  };
}

function comoErroresDeCampo(errores: VariantValidationError[]): ActionResult {
  const fieldErrors: Record<string, string[]> = {};
  for (const error of errores) {
    fieldErrors[error.field] = [...(fieldErrors[error.field] ?? []), error.message];
  }
  return failure('Revisa los campos marcados.', fieldErrors);
}

export async function createVariant(
  productId: string,
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();

  const demo = bloqueadoEnDemostracion();
  if (demo) return demo;

  const input = leerVariante(formData);
  const errores = validateVariant(input);
  if (errores.length > 0) return comoErroresDeCampo(errores);

  const cantidad = Number(String(formData.get('quantity') ?? '0').trim() || '0');
  if (!Number.isInteger(cantidad) || cantidad < 0) {
    return failure('Revisa los campos marcados.', {
      quantity: ['El stock inicial tiene que ser un número entero de cero para arriba.'],
    });
  }

  const supabase = await getSupabaseServerClient();

  const { data: hermanas, error: readError } = await supabase
    .from('product_variants')
    .select('id, sku, position')
    .eq('product_id', productId);

  if (readError) return fromDatabaseError(readError);

  const sku = normalizeSku(input.sku);

  // El índice único de SKU es global, así que Postgres no distingue entre
  // repetirlo dentro de este producto y chocar con otro del catálogo. Son dos
  // problemas distintos y se arreglan distinto.
  if (
    sku !== null &&
    findDuplicateSkus([...(hermanas ?? []).map((v) => v.sku ?? ''), sku]).length
  ) {
    return failure('Revisa los campos marcados.', {
      sku: ['Ya hay otra variante de este producto con ese SKU.'],
    });
  }

  const ultimaPosicion = Math.max(-1, ...(hermanas ?? []).map((v) => v.position));

  const { data: creada, error } = await supabase
    .from('product_variants')
    .insert({
      product_id: productId,
      title: input.title.trim(),
      sku,
      price: input.price,
      compare_at_price: input.compareAtPrice,
      position: ultimaPosicion + 1,
      // La primera variante de un producto es la de por defecto. Sin esto, un
      // producto creado sin variante por defecto no tiene precio que enseñar.
      is_default: (hermanas ?? []).length === 0,
      is_active: true,
    })
    .select('id')
    .single();

  if (error) return fromDatabaseError(error);

  // La fila de inventario la crea un disparador al insertar la variante, así
  // que aquí solo se ajusta la cantidad inicial si la hay.
  if (cantidad > 0 && creada) {
    const { error: stockError } = await supabase
      .from('inventory')
      .update({ quantity: cantidad })
      .eq('variant_id', creada.id);

    if (stockError) return fromDatabaseError(stockError);
  }

  revalidatePath(`/catalogo/${productId}`);
  return success('Variante creada.');
}

export async function updateVariant(
  productId: string,
  variantId: string,
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();

  const demo = bloqueadoEnDemostracion();
  if (demo) return demo;

  const input = leerVariante(formData);
  const errores = validateVariant(input);
  if (errores.length > 0) return comoErroresDeCampo(errores);

  const supabase = await getSupabaseServerClient();

  const { data: hermanas, error: readError } = await supabase
    .from('product_variants')
    .select('id, sku')
    .eq('product_id', productId);

  if (readError) return fromDatabaseError(readError);

  const sku = normalizeSku(input.sku);
  const otras = (hermanas ?? []).filter((v) => v.id !== variantId).map((v) => v.sku ?? '');

  if (sku !== null && findDuplicateSkus([...otras, sku]).length) {
    return failure('Revisa los campos marcados.', {
      sku: ['Ya hay otra variante de este producto con ese SKU.'],
    });
  }

  const problema = checkWrite(
    await supabase
      .from('product_variants')
      .update({
        title: input.title.trim(),
        sku,
        price: input.price,
        compare_at_price: input.compareAtPrice,
        is_active: formData.get('isActive') === 'on',
      })
      .eq('id', variantId)
      .eq('product_id', productId)
      .select('id'),
  );

  if (problema) return problema;

  revalidatePath(`/catalogo/${productId}`);
  return success('Variante actualizada.');
}

/**
 * Marca una variante como la de por defecto.
 *
 * Se quita primero la marca a las demás: hay un índice único parcial
 * (`product_variants_default_key`) que solo admite una por producto, y en el
 * orden contrario la escritura choca contra él.
 */
export async function setDefaultVariant(
  productId: string,
  variantId: string,
): Promise<ActionResult> {
  await requireAdmin();

  const demo = bloqueadoEnDemostracion();
  if (demo) return demo;

  const supabase = await getSupabaseServerClient();

  const { error: clearError } = await supabase
    .from('product_variants')
    .update({ is_default: false })
    .eq('product_id', productId)
    .eq('is_default', true);

  if (clearError) return fromDatabaseError(clearError);

  const problema = checkWrite(
    await supabase
      .from('product_variants')
      .update({ is_default: true, is_active: true })
      .eq('id', variantId)
      .eq('product_id', productId)
      .select('id'),
    'No se pudo marcar por defecto: tu rol no tiene permiso, o la variante ya no existe.',
  );

  if (problema) return problema;

  revalidatePath(`/catalogo/${productId}`);
  return success('Variante por defecto actualizada.');
}

export async function deleteVariant(productId: string, variantId: string): Promise<ActionResult> {
  await requireAdmin();

  const demo = bloqueadoEnDemostracion();
  if (demo) return demo;

  const supabase = await getSupabaseServerClient();

  const { data: variantes, error: readError } = await supabase
    .from('product_variants')
    .select('id, is_default, position, inventory (reserved_quantity)')
    .eq('product_id', productId)
    .order('position');

  if (readError) return fromDatabaseError(readError);

  const objetivo = (variantes ?? []).find((v) => v.id === variantId);
  if (!objetivo) return failure('Esa variante ya no existe.');

  // Un producto sin variantes no tiene precio ni se puede comprar, y la tienda
  // lo pinta como «sin variantes disponibles». Se archiva el producto, no se
  // vacía.
  if ((variantes ?? []).length <= 1) {
    return failure(
      'Es la única variante del producto. Si ya no se vende, archiva el producto en vez de borrarla.',
    );
  }

  // Borrarla se llevaría por delante las reservas de pedidos en curso: la fila
  // de inventario cae en cascada y las unidades comprometidas desaparecen del
  // recuento sin que el pedido se entere.
  const stock = Array.isArray(objetivo.inventory) ? objetivo.inventory[0] : objetivo.inventory;
  if ((stock?.reserved_quantity ?? 0) > 0) {
    return failure(
      'Esta variante tiene unidades reservadas en pedidos sin cumplir. Cumple o cancela esos pedidos antes de borrarla.',
    );
  }

  const problema = checkWrite(
    await supabase
      .from('product_variants')
      .delete()
      .eq('id', variantId)
      .eq('product_id', productId)
      .select('id'),
    'No se borró la variante: tu rol no tiene permiso.',
  );

  if (problema) return problema;

  // Si era la de por defecto, la siguiente hereda: un producto sin variante por
  // defecto no tiene precio que enseñar en el catálogo.
  if (objetivo.is_default) {
    const heredera = (variantes ?? []).find((v) => v.id !== variantId);
    if (heredera) {
      await supabase.from('product_variants').update({ is_default: true }).eq('id', heredera.id);
    }
  }

  revalidatePath(`/catalogo/${productId}`);
  return success('Variante eliminada.');
}
