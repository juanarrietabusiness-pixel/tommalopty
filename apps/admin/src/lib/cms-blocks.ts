import type { MenuItem } from '@nebula/domain';
import type { Json } from '@nebula/db';

/**
 * Conversión entre el texto del editor y los bloques que guarda el CMS.
 *
 * Vive fuera de `actions/cms.ts` porque en un módulo `'use server'` todos los
 * exports deben ser funciones asíncronas, y estas son utilidades puras.
 */

/** Cada párrafo (separado por línea en blanco) se guarda como bloque richtext. */
export function toBlocks(body: string): Json {
  return body
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => ({ type: 'richtext', value: paragraph }));
}

export function fromBlocks(content: Json): string {
  if (!Array.isArray(content)) return '';

  return content
    .map((block) => {
      if (typeof block !== 'object' || block === null || Array.isArray(block)) return '';
      return 'value' in block ? String(block.value) : '';
    })
    .filter(Boolean)
    .join('\n\n');
}

/** Los items del menú, listos para escribirse en la columna `jsonb`. */
export function toMenuJson(items: readonly MenuItem[]): Json {
  return items.map((item) => ({ label: item.label, url: item.url }));
}
