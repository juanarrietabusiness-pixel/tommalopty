import { getCloudflareContext } from '@opennextjs/cloudflare';
import { storage } from '@nebula/integrations';

/**
 * Acceso al bucket de R2 donde viven las imágenes.
 *
 * Se usa el *binding* de Cloudflare y no la API S3 con credenciales, que es la
 * otra forma de llegar a R2. El binding no necesita claves: el Worker tiene
 * acceso al bucket porque así está declarado en `wrangler.jsonc`, así que no
 * hay ningún secreto de larga vida que rotar, filtrar ni guardar. En desarrollo
 * lo sirve el emulador local de wrangler ([ADR 0007](../../../../docs/adr/0007-media-en-cloudflare.md)).
 *
 * El nombre del binding es `MEDIA`.
 */

/** Solo la parte del binding que el panel usa. */
interface MediaBucket {
  put(
    key: string,
    value: ArrayBuffer,
    options?: { httpMetadata?: { contentType?: string; cacheControl?: string } },
  ): Promise<unknown>;
  delete(key: string): Promise<void>;
}

function isMediaBucket(value: unknown): value is MediaBucket {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as MediaBucket).put === 'function' &&
    typeof (value as MediaBucket).delete === 'function'
  );
}

/**
 * Devuelve el bucket, o `null` si no hay ninguno enlazado.
 *
 * Pasa en tres sitios legítimos: durante `next build`, en el modo demostración
 * y en un desarrollo local sin wrangler. En los tres, subir tiene que fallar
 * con un mensaje claro en vez de romperse por dentro.
 */
export function getMediaBucket(): MediaBucket | null {
  try {
    const { env } = getCloudflareContext();
    const bucket = (env as unknown as Record<string, unknown>).MEDIA;
    return isMediaBucket(bucket) ? bucket : null;
  } catch {
    // `getCloudflareContext` lanza fuera del runtime de Workers.
    return null;
  }
}

export type StoreResult = { ok: true; url: string; key: string } | { ok: false; reason: string };

/**
 * Guarda una imagen y devuelve su URL pública.
 *
 * Valida antes de escribir: formato real leído de los bytes, tamaño, y clave
 * construida solo con datos del servidor. Las reglas viven en
 * `@nebula/integrations` para poder probarlas sin bucket.
 */
export async function storeMedia(input: {
  file: File;
  kind: storage.MediaKind;
}): Promise<StoreResult> {
  const bucket = getMediaBucket();

  if (!bucket) {
    return {
      ok: false,
      reason:
        'No hay almacenamiento conectado. En producción esto significa que falta el binding MEDIA en la configuración del Worker.',
    };
  }

  const publicBase = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;

  // Se comprueba antes de escribir: guardar un objeto cuya URL nadie puede
  // componer deja basura en el bucket y una imagen que no se ve.
  if (!publicBase) {
    return {
      ok: false,
      reason:
        'Falta configurar el dominio público de las imágenes (NEXT_PUBLIC_R2_PUBLIC_URL). Sin él la imagen se guardaría pero no se vería.',
    };
  }

  const buffer = await input.file.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  const check = storage.checkMediaUpload({
    declaredType: input.file.type,
    size: input.file.size,
    bytes,
  });

  if (!check.ok) return { ok: false, reason: check.reason };

  const key = storage.buildMediaKey({
    kind: input.kind,
    extension: check.extension,
    id: crypto.randomUUID(),
  });

  const url = storage.publicMediaUrl(key, publicBase);
  if (!url) return { ok: false, reason: 'No se pudo componer la URL pública de la imagen.' };

  try {
    await bucket.put(key, buffer, {
      httpMetadata: {
        // El tipo que se sirve es el que dijeron los bytes, no el que declaró
        // el navegador: es lo único comprobado.
        contentType: check.type,
        // La clave lleva un identificador único, así que el objeto nunca
        // cambia de contenido y puede cachearse para siempre.
        cacheControl: 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('[media] no se pudo guardar en R2', error);
    return { ok: false, reason: 'No se pudo guardar la imagen. Inténtalo de nuevo.' };
  }

  return { ok: true, url, key };
}
