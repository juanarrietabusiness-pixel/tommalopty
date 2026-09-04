'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { isMenuLocation, normalizeMenuItems } from '@nebula/domain';
import { getSupabaseServerClient } from '@/lib/supabase';
import { toBlocks, toMenuJson } from '@/lib/cms-blocks';
import { requireAdmin } from '@/lib/auth';
import { deleteMediaByUrl } from '@/lib/storage';
import {
  bloqueadoEnDemostracion,
  checkWrite,
  failure,
  fromDatabaseError,
  fromZodError,
  success,
  type ActionResult,
} from './result';

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

  const demo = bloqueadoEnDemostracion();
  if (demo) return demo;

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

  // El INSERT sí devuelve error si RLS lo rechaza; el UPDATE no, por eso se
  // comprueban las filas afectadas.
  if (input.id) {
    // Qué imagen tenía antes, para poder limpiarla si la cambian. Se lee antes
    // del UPDATE: después ya no hay forma de saber cuál era.
    const { data: previo } = await supabase
      .from('cms_banners')
      .select('media_url')
      .eq('id', input.id)
      .maybeSingle();

    const problema = checkWrite(
      await supabase.from('cms_banners').update(payload).eq('id', input.id).select('id'),
    );
    if (problema) return problema;

    // Cambiar la imagen de un banner dejaba la anterior en R2 para siempre.
    // Solo se borra si de verdad cambió: guardar el formulario sin tocarla no
    // debe llevarse la imagen que se sigue usando.
    const anterior = previo?.media_url;
    if (anterior && anterior !== payload.media_url) {
      await deleteMediaByUrl(anterior);
    }
  } else {
    const { error } = await supabase.from('cms_banners').insert(payload);
    if (error) return fromDatabaseError(error);
  }

  revalidatePath('/contenido/banners');
  return success(input.id ? 'Banner actualizado.' : 'Banner creado.');
}

export async function deleteBanner(bannerId: string): Promise<ActionResult> {
  await requireAdmin();

  const demo = bloqueadoEnDemostracion();
  if (demo) return demo;

  const supabase = await getSupabaseServerClient();

  // La URL de la imagen, antes de borrar la fila: es lo único que apunta al
  // objeto en R2.
  const { data: banner } = await supabase
    .from('cms_banners')
    .select('media_url')
    .eq('id', bannerId)
    .maybeSingle();

  const problema = checkWrite(
    await supabase.from('cms_banners').delete().eq('id', bannerId).select('id'),
    'No se borró el banner: tu rol no tiene permiso.',
  );

  if (problema) return problema;

  // Después de la fila, como en el resto del proyecto: un huérfano en el bucket
  // es molesto; un banner que apunta a una imagen que ya no existe, visible.
  if (banner?.media_url) await deleteMediaByUrl(banner.media_url);

  revalidatePath('/contenido/banners');
  return success('Banner eliminado.');
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

export async function savePage(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  const demo = bloqueadoEnDemostracion();
  if (demo) return demo;

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

  if (input.id) {
    const problema = checkWrite(
      await supabase.from('cms_pages').update(payload).eq('id', input.id).select('id'),
    );
    if (problema) return problema;
  } else {
    const { error } = await supabase.from('cms_pages').insert(payload);
    if (error) return fromDatabaseError(error);
  }

  revalidatePath('/contenido/paginas');
  return success(input.id ? 'Página actualizada.' : 'Página creada.');
}

/* --- Menús ----------------------------------------------------------------- */

/**
 * Guarda una zona de navegación completa.
 *
 * El formulario manda tantos `label`/`url` como filas tenga, y se emparejan por
 * posición: es lo que permite reordenar, añadir y borrar en un solo envío sin
 * inventar identificadores para algo que en la base de datos es un único JSON.
 *
 * La validación de las URL vive en `@nebula/domain` a propósito. Estos enlaces
 * acaban en un `href` de la tienda pública, así que la regla es de seguridad y
 * la comparten las dos aplicaciones.
 */
export async function saveMenu(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  const demo = bloqueadoEnDemostracion();
  if (demo) return demo;

  const location = String(formData.get('location') ?? '');
  if (!isMenuLocation(location)) {
    return failure('Esa zona de navegación no existe.');
  }

  const labels = formData.getAll('label').map(String);
  const urls = formData.getAll('url').map(String);

  const { items, errors } = normalizeMenuItems(
    labels.map((label, index) => ({ label, url: urls[index] ?? '' })),
  );

  if (errors.length > 0) {
    const fieldErrors: Record<string, string[]> = {};
    for (const problema of errors) {
      const key = `${problema.field}-${problema.index}`;
      fieldErrors[key] = [...(fieldErrors[key] ?? []), problema.message];
    }
    return failure('Revisa los enlaces marcados.', fieldErrors);
  }

  const supabase = await getSupabaseServerClient();

  // `upsert` por `location` y no `update`: las tres zonas existen por seed, pero
  // una base recién creada sin seed no tendría fila y el update fallaría en
  // silencio afectando a cero filas.
  const problema = checkWrite(
    await supabase
      .from('cms_menus')
      .upsert({ location, items: toMenuJson(items) }, { onConflict: 'location' })
      .select('id'),
    'No se guardó el menú: tu rol no tiene permiso.',
  );

  if (problema) return problema;

  revalidatePath('/contenido/menus');
  return success('Menú actualizado. La tienda lo muestra en cuanto revalide.');
}
