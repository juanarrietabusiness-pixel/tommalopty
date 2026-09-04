'use server';

import { revalidatePath } from 'next/cache';
import { storage } from '@nebula/integrations';
import { getSupabaseServerClient } from '@/lib/supabase';
import { requireAdmin, isSuperadmin } from '@/lib/auth';
import { deleteMediaByKey, listarTodoElAlmacenamiento, getMediaBucket } from '@/lib/storage';
import { failure, success, type ActionResult, bloqueadoEnDemostracion } from './result';

/**
 * El barrido de huérfanos: qué hay en el bucket que ya no referencia nadie.
 *
 * Existe porque el arreglo que dejó de generar basura no recoge la que ya
 * estaba. Y como esto **borra ficheros**, todo aquí está escrito para fallar
 * hacia el lado seguro: ante cualquier duda, no se borra.
 *
 * La decisión de qué sobra no vive aquí, sino en `storage.clasificar`, que es
 * puro y está probado por mutación. Aquí solo se recogen los dos lados que hay
 * que comparar — y esa recogida es justo donde está el peligro.
 */

/** Margen por defecto: una imagen subida hoy no se toca aunque no tenga fila. */
const MARGEN_HORAS = 24;

export interface InformeAlmacenamiento {
  disponible: boolean;
  /** `false` si no se pudo enumerar todo; entonces no se ofrece borrar nada. */
  fiable: boolean;
  motivo?: string;
  huerfanos: number;
  bytesHuerfanos: number;
  recientes: number;
  enUso: number;
  ajenos: number;
  /** Una muestra, para que quien mire vea qué se va a borrar antes de borrarlo. */
  muestra: { key: string; bytes: number; subidoEn: string }[];
}

/**
 * Todas las claves que alguna fila referencia.
 *
 * Devuelve `null` si **cualquier** consulta falla, y quien llama lo traduce en
 * «no se barre». Es la guarda que más importa de todo el archivo: una lista de
 * referencias incompleta convierte el catálogo entero en «huérfano».
 */
async function clavesReferenciadas(): Promise<Set<string> | null> {
  const supabase = await getSupabaseServerClient();
  const base = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;
  const claves = new Set<string>();

  const { data: imagenes, error: errorImagenes } = await supabase
    .from('product_images')
    .select('url');

  if (errorImagenes) {
    console.error('[barrido] no se pudieron leer las imágenes de producto', errorImagenes);
    return null;
  }

  const { data: banners, error: errorBanners } = await supabase
    .from('cms_banners')
    .select('media_url');

  if (errorBanners) {
    console.error('[barrido] no se pudieron leer los banners', errorBanners);
    return null;
  }

  for (const fila of imagenes ?? []) {
    const clave = storage.mediaKeyFromUrl(fila.url, base);
    if (clave) claves.add(clave);
  }

  for (const fila of banners ?? []) {
    if (!fila.media_url) continue;
    const clave = storage.mediaKeyFromUrl(fila.media_url, base);
    if (clave) claves.add(clave);
  }

  return claves;
}

async function analizar(): Promise<
  | { ok: true; informe: InformeAlmacenamiento; huerfanos: string[] }
  | { ok: false; informe: InformeAlmacenamiento }
> {
  const vacio: InformeAlmacenamiento = {
    disponible: false,
    fiable: false,
    huerfanos: 0,
    bytesHuerfanos: 0,
    recientes: 0,
    enUso: 0,
    ajenos: 0,
    muestra: [],
  };

  if (!getMediaBucket()) {
    return { ok: false, informe: { ...vacio, motivo: 'No hay bucket enlazado en este entorno.' } };
  }

  const objetos = await listarTodoElAlmacenamiento();
  if (!objetos) {
    return {
      ok: false,
      informe: { ...vacio, disponible: true, motivo: 'No se pudo listar el bucket entero.' },
    };
  }

  const referencias = await clavesReferenciadas();

  // Aquí es donde se decide no borrar. `clasificar` ya lo respeta, pero se dice
  // también en el informe para que quien mire entienda por qué no hay nada que
  // barrer en vez de creer que el bucket está limpio.
  if (!referencias) {
    return {
      ok: false,
      informe: {
        ...vacio,
        disponible: true,
        motivo: 'No se pudieron enumerar las imágenes en uso, así que no se barre nada.',
      },
    };
  }

  const resultado = storage.clasificar({
    objetos,
    clavesEnUso: referencias,
    enumeracionCompleta: true,
    ahora: new Date(),
    margenHoras: MARGEN_HORAS,
  });

  return {
    ok: true,
    huerfanos: resultado.huerfanos.map((o) => o.key),
    informe: {
      disponible: true,
      fiable: true,
      huerfanos: resultado.huerfanos.length,
      bytesHuerfanos: resultado.bytesHuerfanos,
      recientes: resultado.recientes.length,
      enUso: resultado.enUso.length,
      ajenos: resultado.ajenos.length,
      muestra: resultado.huerfanos.slice(0, 20).map((o) => ({
        key: o.key,
        bytes: o.bytes,
        subidoEn: o.subidoEn.toISOString(),
      })),
    },
  };
}

/** Mira sin tocar. Es lo que se ejecuta al abrir la pantalla. */
export async function inspeccionarAlmacenamiento(): Promise<InformeAlmacenamiento> {
  await requireAdmin();
  const resultado = await analizar();
  return resultado.informe;
}

/**
 * Borra los huérfanos. Solo superadministrador, y solo lo que el análisis
 * acaba de clasificar — no una lista que venga del navegador.
 *
 * Se vuelve a analizar aquí en lugar de fiarse de lo que se enseñó: entre que
 * alguien miró la pantalla y pulsó el botón puede haberse subido una imagen, y
 * esa no debe estar en la lista.
 */
export async function barrerHuerfanos(): Promise<ActionResult> {
  const sesion = await requireAdmin();

  if (!isSuperadmin(sesion.role)) {
    return failure('Solo un superadministrador puede vaciar el almacenamiento.');
  }

  const demo = bloqueadoEnDemostracion();
  if (demo) return demo;

  const resultado = await analizar();

  if (!resultado.ok) {
    return failure(resultado.informe.motivo ?? 'No se pudo analizar el almacenamiento.');
  }

  if (resultado.huerfanos.length === 0) {
    return success('No hay nada que borrar: el almacenamiento está limpio.');
  }

  let borrados = 0;
  let fallidos = 0;

  for (const clave of resultado.huerfanos) {
    if (await deleteMediaByKey(clave)) borrados += 1;
    else fallidos += 1;
  }

  revalidatePath('/configuracion/almacenamiento');

  if (fallidos > 0) {
    return success(
      `Se borraron ${borrados} ficheros huérfanos. ${fallidos} no se pudieron borrar; quedan para el próximo barrido.`,
    );
  }

  return success(`Se borraron ${borrados} ficheros huérfanos.`);
}
