import type { SupabaseClient } from '@supabase/supabase-js';
import { parseMenuItems, type MenuItem } from '@nebula/domain';
import type { Database, Tables } from '../generated/database.types';

type Client = SupabaseClient<Database>;

export type Banner = Tables<'cms_banners'>;
export type CmsPage = Tables<'cms_pages'>;
export type CmsPost = Tables<'cms_posts'>;

// La forma de un enlace de menú —y las reglas de qué URL es segura ponerle a
// un `href`— viven en `@nebula/domain`, porque la tienda y el panel tienen que
// coincidir. Aquí solo se reexporta para quien ya importaba desde `@nebula/db`.
export type { MenuItem };

/**
 * Banner activo de una zona ('announcement_bar' | 'hero' | 'cta_band').
 * RLS ya filtra por ventana de vigencia para los visitantes.
 */
export async function getBanner(client: Client, placement: string): Promise<Banner | null> {
  const { data, error } = await client
    .from('cms_banners')
    .select('*')
    .eq('placement', placement)
    .eq('is_active', true)
    .order('position')
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getMenu(client: Client, location: string): Promise<MenuItem[]> {
  const { data, error } = await client
    .from('cms_menus')
    .select('items')
    .eq('location', location)
    .maybeSingle();

  if (error) throw error;
  return parseMenuItems(data?.items);
}

export async function getPage(client: Client, slug: string): Promise<CmsPage | null> {
  const { data, error } = await client
    .from('cms_pages')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function listPublishedPageSlugs(client: Client) {
  const { data, error } = await client
    .from('cms_pages')
    .select('slug, updated_at')
    .eq('status', 'published');

  if (error) throw error;
  return data ?? [];
}

export async function listPosts(client: Client, limit = 12) {
  const { data, error } = await client
    .from('cms_posts')
    .select('id, slug, title, excerpt, cover_url, published_at, tags')
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

/** Ajustes públicos indexados por clave (marca, tienda, checkout…). */
export async function getPublicSettings(client: Client): Promise<Record<string, unknown>> {
  const { data, error } = await client.from('settings').select('key, value').eq('is_public', true);

  if (error) throw error;

  return Object.fromEntries((data ?? []).map((row) => [row.key, row.value]));
}
