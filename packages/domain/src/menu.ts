/**
 * Reglas de los menús de navegación del CMS.
 *
 * Esto no es solo validación de formulario: los enlaces que se guardan aquí
 * terminan en un `href` de la tienda pública, así que este archivo es una
 * frontera de seguridad. Una URL `javascript:` guardada como enlace de menú se
 * ejecuta en el navegador de cada visitante que pase por la cabecera o el pie.
 *
 * Vive en `domain` —y no en el panel— porque la tienda también necesita poder
 * comprobar lo que renderiza, y las dos aplicaciones tienen que coincidir.
 */

export interface MenuItem {
  label: string;
  url: string;
}

/** Las tres zonas de navegación que la tienda sabe renderizar. */
export const MENU_LOCATIONS = ['header', 'footer_shop', 'footer_help'] as const;

export type MenuLocation = (typeof MENU_LOCATIONS)[number];

export const MENU_LOCATION_LABELS: Record<MenuLocation, string> = {
  header: 'Cabecera',
  footer_shop: 'Pie · Tienda',
  footer_help: 'Pie · Ayuda',
};

export const MAX_MENU_ITEMS = 12;
export const MAX_MENU_LABEL_LENGTH = 40;
export const MAX_MENU_URL_LENGTH = 300;

/**
 * Esquemas que pueden aparecer en un enlace de menú.
 *
 * La lista es blanca a propósito. Una lista negra ("todo menos javascript:")
 * se salta con `data:`, `vbscript:` o cualquier esquema que un navegador
 * futuro decida ejecutar.
 */
const ALLOWED_SCHEMES = new Set(['http', 'https', 'mailto', 'tel']);

// Los navegadores ignoran los caracteres de control dentro de un href, así que
// `java\nscript:alert(1)` se ejecuta igual que `javascript:alert(1)`. Se
// limpian antes de mirar el esquema, no después.
//
// `no-control-regex` existe para cazar caracteres de control puestos sin
// querer; aquí son exactamente lo que hay que detectar, así que la regla se
// apaga en esta línea y solo en esta.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F]/g;

const SCHEME = /^([a-zA-Z][a-zA-Z0-9+.-]*):/;

export function isMenuLocation(value: string): value is MenuLocation {
  return (MENU_LOCATIONS as readonly string[]).includes(value);
}

/**
 * ¿Es seguro poner esta URL en un `href`?
 *
 * Se aceptan rutas internas (`/tienda`, `/p/envios?x=1`), URLs http/https, y
 * `mailto:` / `tel:` para los enlaces de contacto del pie. Nada más.
 */
export function isSafeMenuUrl(url: string): boolean {
  const clean = url.replace(CONTROL_CHARS, '').trim();

  if (clean === '') return false;

  // `//evil.com` es relativa al protocolo: parece interna y sale del sitio.
  if (clean.startsWith('//')) return false;

  // Ruta interna. Es el caso normal.
  if (clean.startsWith('/')) return true;

  const scheme = SCHEME.exec(clean)?.[1];

  // Sin esquema y sin `/` inicial (`tienda`, `../algo`) se resuelve contra la
  // página actual, así que el mismo enlace apunta a sitios distintos según
  // dónde se pinte. Se rechaza para que la URL guardada signifique una cosa.
  if (!scheme) return false;

  return ALLOWED_SCHEMES.has(scheme.toLowerCase());
}

/**
 * Lee los items tal y como vienen de la columna `jsonb`.
 *
 * La columna acepta cualquier JSON, así que lo que sale de ella no es un
 * `MenuItem[]` por mucho que el tipo generado lo insinúe: puede venir de un
 * `insert` a mano, de un seed viejo o de una versión anterior del editor. Las
 * filas que no tengan texto y destino se descartan, porque pintar un enlace con
 * `undefined` dentro del href es peor que no pintarlo.
 */
export function parseMenuItems(value: unknown): MenuItem[] {
  if (!Array.isArray(value)) return [];

  const items: MenuItem[] = [];

  for (const row of value) {
    if (typeof row !== 'object' || row === null || Array.isArray(row)) continue;

    const { label, url } = row as { label?: unknown; url?: unknown };
    if (typeof label !== 'string' || typeof url !== 'string') continue;
    if (label.trim() === '' || url.trim() === '') continue;

    items.push({ label, url });
  }

  return items;
}

export interface MenuValidationError {
  index: number;
  field: 'label' | 'url';
  message: string;
}

export interface NormalizedMenu {
  items: MenuItem[];
  errors: MenuValidationError[];
}

/**
 * Limpia y valida lo que viene del formulario.
 *
 * Las filas completamente vacías se descartan en silencio: son el hueco que
 * deja quien borra un enlace, no un error que haya que enseñarle.
 *
 * Si hay un solo error no se devuelve ningún item: guardar un menú a medias
 * dejaría la cabecera de la tienda con enlaces que el operador creía haber
 * corregido.
 */
export function normalizeMenuItems(raw: readonly { label: string; url: string }[]): NormalizedMenu {
  const items: MenuItem[] = [];
  const errors: MenuValidationError[] = [];

  raw.forEach((row, index) => {
    const label = row.label.trim();
    const url = row.url.replace(CONTROL_CHARS, '').trim();

    if (label === '' && url === '') return;

    if (label === '') {
      errors.push({ index, field: 'label', message: 'Escribe el texto del enlace.' });
    } else if (label.length > MAX_MENU_LABEL_LENGTH) {
      errors.push({
        index,
        field: 'label',
        message: `El texto no puede pasar de ${MAX_MENU_LABEL_LENGTH} caracteres.`,
      });
    }

    if (url === '') {
      errors.push({ index, field: 'url', message: 'Escribe el destino del enlace.' });
    } else if (url.length > MAX_MENU_URL_LENGTH) {
      errors.push({
        index,
        field: 'url',
        message: `El destino no puede pasar de ${MAX_MENU_URL_LENGTH} caracteres.`,
      });
    } else if (!isSafeMenuUrl(url)) {
      errors.push({
        index,
        field: 'url',
        message: 'Usa una ruta que empiece por «/», o una dirección http(s), mailto: o tel:.',
      });
    }

    items.push({ label, url });
  });

  if (items.length > MAX_MENU_ITEMS) {
    errors.push({
      index: MAX_MENU_ITEMS,
      field: 'label',
      message: `Un menú no puede tener más de ${MAX_MENU_ITEMS} enlaces.`,
    });
  }

  return { items: errors.length > 0 ? [] : items, errors };
}
