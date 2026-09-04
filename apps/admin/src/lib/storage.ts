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
interface ObjetoListado {
  key: string;
  size: number;
  uploaded: Date;
}

interface ListadoR2 {
  objects: ObjetoListado[];
  truncated: boolean;
  cursor?: string;
}

interface MediaBucket {
  put(
    key: string,
    value: ArrayBuffer,
    options?: { httpMetadata?: { contentType?: string; cacheControl?: string } },
  ): Promise<unknown>;
  delete(key: string): Promise<void>;
  list(options?: { limit?: number; cursor?: string; prefix?: string }): Promise<ListadoR2>;
}

function isMediaBucket(value: unknown): value is MediaBucket {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as MediaBucket).put === 'function' &&
    typeof (value as MediaBucket).delete === 'function' &&
    typeof (value as MediaBucket).list === 'function'
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

/**
 * Borra de R2 el objeto al que apunta una URL guardada.
 *
 * Existe porque hasta ahora no existía: borrar una imagen quitaba su fila de
 * `product_images` y dejaba el fichero en el bucket **para siempre**. Cada
 * imagen borrada desde que la tienda existe sigue ahí ocupando y costando.
 *
 * Nunca lanza, y devuelve qué pasó en vez de un booleano, porque quien llama
 * necesita distinguir dos casos que se arreglan distinto:
 *
 * - `sin-clave`: la URL no es de nuestro dominio de medios, así que no hay nada
 *   que borrar con seguridad. Pasa con imágenes anteriores a un cambio de
 *   dominio público, y esas las recoge un barrido de huérfanos, no esto.
 * - `error`: el bucket estaba y falló. Ahí sí hay un huérfano nuevo y conviene
 *   que quede en el log.
 *
 * El orden lo decide quien llama, y la convención del proyecto —la de
 * `borrarAbono`— es borrar primero la fila y después el objeto: si el objeto
 * sobrevive, hay basura; si sobrevive la fila, hay una imagen rota en el
 * catálogo, que es peor.
 */
export type DeleteMediaResult =
  { ok: true; key: string } | { ok: false; reason: 'sin-bucket' | 'sin-clave' | 'error' };

export async function deleteMediaByUrl(url: string): Promise<DeleteMediaResult> {
  const clave = storage.mediaKeyFromUrl(url, process.env.NEXT_PUBLIC_R2_PUBLIC_URL);

  if (!clave) {
    console.warn(
      `[media] no se pudo deducir la clave de "${url}": queda un huérfano en el bucket.`,
    );
    return { ok: false, reason: 'sin-clave' };
  }

  const bucket = getMediaBucket();
  if (!bucket) return { ok: false, reason: 'sin-bucket' };

  try {
    await bucket.delete(clave);
    return { ok: true, key: clave };
  } catch (error) {
    console.error(`[media] no se pudo borrar "${clave}" de R2`, error);
    return { ok: false, reason: 'error' };
  }
}

/**
 * Recorre el bucket entero, página a página.
 *
 * Devuelve `null` —y no una lista a medias— si alguna página falla. La
 * diferencia no es cosmética: una lista incompleta de objetos combinada con la
 * comparación del barrido no borra de más, pero una lista incompleta de
 * *referencias* sí borraría de más, así que la regla en todo este camino es la
 * misma: o entero, o nada.
 */
export async function listarTodoElAlmacenamiento(): Promise<storage.ObjetoAlmacenado[] | null> {
  const bucket = getMediaBucket();
  if (!bucket) return null;

  const objetos: storage.ObjetoAlmacenado[] = [];
  let cursor: string | undefined;

  // Tope de seguridad: 200 páginas de 1000 son 200.000 objetos. Si un bucket
  // llegara ahí, es mejor devolver `null` y que alguien lo mire que iterar sin
  // fin dentro de una petición.
  for (let pagina = 0; pagina < 200; pagina += 1) {
    let lote: Awaited<ReturnType<MediaBucket['list']>>;

    try {
      lote = await bucket.list({ limit: 1000, cursor });
    } catch (error) {
      console.error('[media] falló el listado del bucket', error);
      return null;
    }

    for (const objeto of lote.objects) {
      objetos.push({ key: objeto.key, bytes: objeto.size, subidoEn: new Date(objeto.uploaded) });
    }

    if (!lote.truncated) return objetos;
    cursor = lote.cursor;
  }

  console.error('[media] el bucket tiene más páginas de las esperadas; no se barre a medias');
  return null;
}

/** Borra una clave ya clasificada como huérfana. No deduce nada: eso ya se hizo. */
export async function deleteMediaByKey(key: string): Promise<boolean> {
  const bucket = getMediaBucket();
  if (!bucket) return false;

  try {
    await bucket.delete(key);
    return true;
  } catch (error) {
    console.error(`[media] no se pudo borrar "${key}"`, error);
    return false;
  }
}
