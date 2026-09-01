import { getCloudflareContext } from '@opennextjs/cloudflare';

/**
 * El bucket privado, desde la tienda.
 *
 * Aquí solo se **escribe**: el motorizado sube la foto de la prueba de entrega.
 * Leerla es cosa del panel, que es donde se mira. El binding se declara en
 * `wrangler.jsonc` y por eso no hay ninguna credencial que rotar.
 *
 * Este archivo está duplicado casi igual en el panel, y es a propósito: son dos
 * Workers distintos con dos `wrangler.jsonc` distintos, y `getCloudflareContext`
 * viene del adaptador de cada aplicación. Compartirlo desde `@nebula/ui`
 * arrastraría el adaptador de Cloudflare a un paquete que también usan los
 * tests, que no corren dentro de un Worker.
 */

export interface BucketPrivado {
  put(
    key: string,
    value: ArrayBuffer,
    options?: { httpMetadata?: { contentType?: string; cacheControl?: string } },
  ): Promise<unknown>;
  get(
    key: string,
  ): Promise<{ body: ReadableStream; httpMetadata?: { contentType?: string } } | null>;
  delete(key: string): Promise<void>;
}

function esBucket(valor: unknown): valor is BucketPrivado {
  return (
    typeof valor === 'object' &&
    valor !== null &&
    typeof (valor as BucketPrivado).put === 'function' &&
    typeof (valor as BucketPrivado).get === 'function'
  );
}

/**
 * Devuelve el bucket, o `null` si no hay ninguno enlazado.
 *
 * Pasa en tres sitios legítimos: durante `next build`, en modo demostración y en
 * un desarrollo local sin wrangler. En los tres, subir tiene que fallar con un
 * mensaje claro en vez de romperse por dentro.
 */
export function getBucketPrivado(): BucketPrivado | null {
  try {
    const { env } = getCloudflareContext();
    const bucket = (env as unknown as Record<string, unknown>).MEDIA_PRIVADA;
    return esBucket(bucket) ? bucket : null;
  } catch {
    // `getCloudflareContext` lanza fuera del runtime de Workers.
    return null;
  }
}
