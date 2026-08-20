import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Views } from '../generated/database.types';

type Client = SupabaseClient<Database>;

export type CatalogProduct = Views<'product_catalog'>;

export interface ListProductsOptions {
  categorySlug?: string;
  search?: string;
  featuredOnly?: boolean;
  onSaleOnly?: boolean;
  sort?: 'recent' | 'price_asc' | 'price_desc' | 'rating';
  limit?: number;
  offset?: number;
}

/**
 * Listado del catálogo público.
 * Lee de la vista `product_catalog`, que ya resuelve variante por defecto,
 * imagen principal y stock disponible en una sola consulta.
 */
export async function listProducts(
  client: Client,
  options: ListProductsOptions = {},
): Promise<{ products: CatalogProduct[]; total: number }> {
  const { limit = 20, offset = 0 } = options;

  // Filtrar por categoría exige pasar antes por la tabla de relación.
  let productIds: string[] | null = null;
  if (options.categorySlug) {
    const { data: category } = await client
      .from('categories')
      .select('id')
      .eq('slug', options.categorySlug)
      .maybeSingle();

    if (!category) return { products: [], total: 0 };

    const { data: relations } = await client
      .from('product_categories')
      .select('product_id')
      .eq('category_id', category.id);

    productIds = (relations ?? []).map((relation) => relation.product_id);
    if (productIds.length === 0) return { products: [], total: 0 };
  }

  let query = client.from('product_catalog').select('*', { count: 'exact' }).eq('status', 'active');

  if (productIds) query = query.in('id', productIds);
  if (options.featuredOnly) query = query.eq('is_featured', true);
  if (options.onSaleOnly) query = query.eq('on_sale', true);
  if (options.search) query = query.ilike('title', `%${options.search}%`);

  switch (options.sort) {
    case 'price_asc':
      query = query.order('price', { ascending: true, nullsFirst: false });
      break;
    case 'price_desc':
      query = query.order('price', { ascending: false, nullsFirst: false });
      break;
    case 'rating':
      query = query.order('rating_average', { ascending: false, nullsFirst: false });
      break;
    default:
      query = query.order('published_at', { ascending: false, nullsFirst: false });
  }

  const { data, error, count } = await query.range(offset, offset + limit - 1);
  if (error) throw error;

  return { products: data ?? [], total: count ?? 0 };
}

/** Búsqueda full-text vía RPC (`search_products`). */
export async function searchProducts(
  client: Client,
  term: string,
  limit = 24,
  offset = 0,
): Promise<CatalogProduct[]> {
  const { data, error } = await client.rpc('search_products', {
    p_query: term,
    p_limit: limit,
    p_offset: offset,
  });
  if (error) throw error;
  return data ?? [];
}

export interface ProductDetail {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  brand: string | null;
  tags: string[];
  seo_title: string | null;
  seo_description: string | null;
  rating_average: number;
  rating_count: number;
  images: { id: string; url: string; alt: string | null; is_primary: boolean }[];
  options: { id: string; name: string; values: string[] }[];
  variants: {
    id: string;
    title: string;
    sku: string | null;
    price: number;
    compare_at_price: number | null;
    option_values: unknown;
    is_default: boolean;
    available_quantity: number;
    track_inventory: boolean;
  }[];
}

/** Ficha completa de producto para la página de detalle (SSR/ISR). */
export async function getProductBySlug(
  client: Client,
  slug: string,
): Promise<ProductDetail | null> {
  const { data, error } = await client
    .from('products')
    .select(
      `id, slug, title, subtitle, description, brand, tags, seo_title, seo_description,
       rating_average, rating_count,
       product_images (id, url, alt, is_primary, position),
       product_options (id, name, values, position),
       product_variants (
         id, title, sku, price, compare_at_price, option_values, is_default, position, is_active,
         inventory (quantity, reserved_quantity, track_inventory)
       )`,
    )
    .eq('slug', slug)
    .eq('status', 'active')
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const images = [...(data.product_images ?? [])]
    .sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.position - b.position)
    .map((image) => ({
      id: image.id,
      url: image.url,
      alt: image.alt,
      is_primary: image.is_primary,
    }));

  const variants = (data.product_variants ?? [])
    .filter((variant) => variant.is_active)
    .sort((a, b) => Number(b.is_default) - Number(a.is_default) || a.position - b.position)
    .map((variant) => {
      // `inventory` llega como objeto (relación 1:1) o como array según el join.
      const inventory = Array.isArray(variant.inventory) ? variant.inventory[0] : variant.inventory;
      const quantity = inventory?.quantity ?? 0;
      const reserved = inventory?.reserved_quantity ?? 0;

      return {
        id: variant.id,
        title: variant.title,
        sku: variant.sku,
        price: variant.price,
        compare_at_price: variant.compare_at_price,
        option_values: variant.option_values,
        is_default: variant.is_default,
        available_quantity: Math.max(quantity - reserved, 0),
        track_inventory: inventory?.track_inventory ?? false,
      };
    });

  return {
    id: data.id,
    slug: data.slug,
    title: data.title,
    subtitle: data.subtitle,
    description: data.description,
    brand: data.brand,
    tags: data.tags,
    seo_title: data.seo_title,
    seo_description: data.seo_description,
    rating_average: data.rating_average,
    rating_count: data.rating_count,
    images,
    options: (data.product_options ?? [])
      .sort((a, b) => a.position - b.position)
      .map((option) => ({ id: option.id, name: option.name, values: option.values })),
    variants,
  };
}

/** Slugs publicados: alimenta `generateStaticParams` y el sitemap. */
export async function listPublishedProductSlugs(
  client: Client,
): Promise<{ slug: string; updated_at: string }[]> {
  const { data, error } = await client
    .from('products')
    .select('slug, updated_at')
    .eq('status', 'active')
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function listCategories(client: Client) {
  const { data, error } = await client
    .from('categories')
    .select('id, slug, name, description, parent_id, position')
    .eq('is_active', true)
    .order('position');

  if (error) throw error;
  return data ?? [];
}
