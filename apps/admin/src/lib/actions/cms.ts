'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getSupabaseServerClient } from '@/lib/supabase';
import { toBlocks } from '@/lib/cms-blocks';
import { requireAdmin } from '@/lib/auth';
import { fromDatabaseError, fromZodError, success, type ActionResult } from './result';

/**
 * CMS propio: banners y páginas se editan aquí y la tienda los lee por ISR,
 * así que un cambio se ve publicado sin desplegar nada.
 */

/* --- Banners --------------------------------------------------------------- */

const bannerSchema = z.object({
  id: z.uuid().optional(),
  placement: z.enum(['announcement_bar', 'hero', 'cta_band']),
  eyebrow: z.string().optional(),
  title: z.string().optional(),
  subtitle: z.string().optional(),
  ctaLabel: z.string().optional(),
  ctaUrl: z.string().optional(),
  mediaUrl: z.string().optional(),
  isActive: z.boolean(),
});

function parseBanner(formData: FormData) {
  return bannerSchema.safeParse({
    id: formData.get('id') || undefined,
    placement: formData.get('placement'),
    eyebrow: formData.get('eyebrow') || undefined,
    title: formData.get('title') || undefined,
    subtitle: formData.get('subtitle') || undefined,
    ctaLabel: formData.get('ctaLabel') || undefined,
    ctaUrl: formData.get('ctaUrl') || undefined,
    mediaUrl: formData.get('mediaUrl') || undefined,
    isActive: formData.get('isActive') === 'on',
  });
}

export async function saveBanner(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();

  const parsed = parseBanner(formData);
  if (!parsed.success) return fromZodError(parsed.error);

  const input = parsed.data;
  const supabase = await getSupabaseServerClient();

  const payload = {
    placement: input.placement,
    eyebrow: input.eyebrow ?? null,
    title: input.title ?? null,
    subtitle: input.subtitle ?? null,
    cta_label: input.ctaLabel ?? null,
    cta_url: input.ctaUrl ?? null,
    media_url: input.mediaUrl ?? null,
    is_active: input.isActive,
  };

  const { error } = input.id
    ? await supabase.from('cms_banners').update(payload).eq('id', input.id)
    : await supabase.from('cms_banners').insert(payload);

  if (error) return fromDatabaseError(error);

  revalidatePath('/contenido/banners');
  return success(input.id ? 'Banner actualizado.' : 'Banner creado.');
}

export async function deleteBanner(bannerId: string): Promise<void> {
  await requireAdmin();

  const supabase = await getSupabaseServerClient();
  await supabase.from('cms_banners').delete().eq('id', bannerId);

  revalidatePath('/contenido/banners');
}

/* --- Páginas --------------------------------------------------------------- */

const pageSchema = z.object({
  id: z.uuid().optional(),
  title: z.string().min(2, 'El título es obligatorio'),
  slug: z
    .string()
    .min(2, 'El slug es obligatorio')
    .regex(/^[a-z0-9-]+$/, 'Solo minúsculas, números y guiones'),
  body: z.string().min(1, 'El contenido no puede estar vacío'),
  status: z.enum(['draft', 'published', 'archived']),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
});

export async function savePage(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();

  const parsed = pageSchema.safeParse({
    id: formData.get('id') || undefined,
    title: formData.get('title'),
    slug: formData.get('slug'),
    body: formData.get('body'),
    status: formData.get('status'),
    seoTitle: formData.get('seoTitle') || undefined,
    seoDescription: formData.get('seoDescription') || undefined,
  });

  if (!parsed.success) return fromZodError(parsed.error);

  const input = parsed.data;
  const supabase = await getSupabaseServerClient();

  const payload = {
    title: input.title,
    slug: input.slug,
    content: toBlocks(input.body),
    status: input.status,
    seo_title: input.seoTitle ?? null,
    seo_description: input.seoDescription ?? null,
    published_at: input.status === 'published' ? new Date().toISOString() : null,
  };

  const { error } = input.id
    ? await supabase.from('cms_pages').update(payload).eq('id', input.id)
    : await supabase.from('cms_pages').insert(payload);

  if (error) return fromDatabaseError(error);

  revalidatePath('/contenido/paginas');
  return success(input.id ? 'Página actualizada.' : 'Página creada.');
}
