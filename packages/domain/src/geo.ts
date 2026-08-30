/**
 * Coordenadas, zonas de cobertura y enlaces de navegación.
 *
 * Todo lo de aquí es puro. Es deliberado: la comprobación de si un punto cae
 * dentro de una zona de reparto decide si se acepta un pedido, y esa decisión
 * tiene que poder probarse sin levantar una base de datos ni un mapa.
 *
 * La convención de orden es la de GeoJSON —`[lng, lat]`— en los polígonos, y
 * `{ lat, lng }` con nombre en los puntos. Mezclar las dos sin darse cuenta es
 * el error clásico de todo código que toca mapas, y por eso los polígonos van
 * en posiciones y los puntos con nombre: no se pueden confundir.
 */

export interface Coordinates {
  lat: number;
  lng: number;
}

/** De dónde salió el punto. Importa tanto como el punto. */
export const LOCATION_PRECISIONS = ['gps', 'pin', 'geocoded', 'manual'] as const;

export type LocationPrecision = (typeof LOCATION_PRECISIONS)[number];

export const LOCATION_PRECISION_LABELS: Record<LocationPrecision, string> = {
  gps: 'Ubicación del dispositivo',
  pin: 'Marcada en el mapa',
  geocoded: 'Deducida de la búsqueda',
  manual: 'Escrita a mano',
};

export function isLocationPrecision(value: string): value is LocationPrecision {
  return (LOCATION_PRECISIONS as readonly string[]).includes(value);
}

/**
 * Caja que envuelve Panamá, con margen.
 *
 * No se usa para prohibir: se usa para avisar. Un punto fuera de aquí casi
 * siempre es un error de captura —coordenadas invertidas, un cero de más— y
 * conviene decirlo antes de mandar a alguien. Pero una tienda que un día envíe
 * fuera del país no debería necesitar una migración para poder hacerlo.
 */
export const PANAMA_BOUNDS = {
  minLat: 7.0,
  maxLat: 9.8,
  minLng: -83.2,
  maxLng: -77.0,
} as const;

/** Centro aproximado de Ciudad de Panamá: dónde abrir el mapa sin permiso. */
export const PANAMA_CITY_CENTER: Coordinates = { lat: 8.9824, lng: -79.5199 };

export function isValidCoordinates(point: Coordinates): boolean {
  return (
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lng) &&
    point.lat >= -90 &&
    point.lat <= 90 &&
    point.lng >= -180 &&
    point.lng <= 180
  );
}

export function isWithinPanama(point: Coordinates): boolean {
  if (!isValidCoordinates(point)) return false;

  return (
    point.lat >= PANAMA_BOUNDS.minLat &&
    point.lat <= PANAMA_BOUNDS.maxLat &&
    point.lng >= PANAMA_BOUNDS.minLng &&
    point.lng <= PANAMA_BOUNDS.maxLng
  );
}

/**
 * Redondea a siete decimales, que es lo que guarda la columna.
 *
 * Sin esto, el valor que se enseña tras guardar no coincide con el que se
 * envió, y parece que el mapa «movió» el punto solo.
 */
export function roundCoordinate(value: number): number {
  return Math.round(value * 1e7) / 1e7;
}

/** Un anillo de polígono en orden GeoJSON: `[lng, lat]`. */
export type PolygonRing = readonly (readonly [number, number])[];

/**
 * ¿Cae el punto dentro del polígono?
 *
 * Algoritmo de cruce de rayos. Se lanza un rayo horizontal hacia el infinito y
 * se cuentan los lados que cruza: impar dentro, par fuera.
 *
 * Los puntos justo sobre el borde son ambiguos por naturaleza —dependen de la
 * precisión de coma flotante— así que no se promete nada sobre ellos. Para
 * decidir una zona de reparto da igual: una casa no está en el borde exacto de
 * un polígono dibujado a mano.
 */
export function isPointInPolygon(point: Coordinates, ring: PolygonRing): boolean {
  // Un polígono necesita al menos tres vértices para encerrar algo.
  if (ring.length < 3) return false;
  if (!isValidCoordinates(point)) return false;

  let dentro = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const actual = ring[i];
    const anterior = ring[j];
    if (!actual || !anterior) continue;

    const [xi, yi] = actual;
    const [xj, yj] = anterior;

    // ¿El lado cruza la horizontal que pasa por el punto?
    const cruzaLaHorizontal = yi > point.lat !== yj > point.lat;
    if (!cruzaLaHorizontal) continue;

    // Longitud del lado a la altura del punto.
    const corte = ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi;
    if (point.lng < corte) dentro = !dentro;
  }

  return dentro;
}

export interface DeliveryZone {
  id: string;
  name: string;
  polygon: PolygonRing;
  shippingPrice: number | null;
  handledBy: 'propio' | 'courier';
}

/**
 * La primera zona que contiene el punto, o `null` si ninguna llega.
 *
 * Se devuelve la primera y no «la mejor» a propósito: las zonas se ordenan por
 * `position`, así que quien las configura decide la prioridad cuando se solapan.
 * Adivinarlo aquí haría que el mismo punto cambiara de tarifa sin que nadie
 * hubiera tocado nada.
 */
export function findZoneForPoint(
  point: Coordinates,
  zones: readonly DeliveryZone[],
): DeliveryZone | null {
  for (const zone of zones) {
    if (isPointInPolygon(point, zone.polygon)) return zone;
  }
  return null;
}

/**
 * Lee un polígono tal y como viene de la columna `jsonb`.
 *
 * La columna acepta cualquier JSON, así que lo que sale no es un polígono por
 * mucho que el tipo lo insinúe. Un anillo a medio escribir es peor que uno
 * vacío: haría que `isPointInPolygon` respondiera que sí a puntos que no.
 */
export function parsePolygon(value: unknown): PolygonRing {
  if (!Array.isArray(value)) return [];

  const ring: [number, number][] = [];

  for (const par of value) {
    if (!Array.isArray(par) || par.length < 2) return [];

    const [lng, lat] = par;
    if (typeof lng !== 'number' || typeof lat !== 'number') return [];
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return [];

    ring.push([lng, lat]);
  }

  return ring.length >= 3 ? ring : [];
}

/**
 * Enlace de navegación para quien entrega.
 *
 * Se devuelven las dos apps y no una: en Panamá Waze es lo que usa la mayoría
 * de motorizados, pero no todos lo tienen. Quien entrega elige, y por eso el QR
 * de la fase L2 apunta a una página con los dos botones y no a un mapa
 * concreto — un `geo:` crudo abre lo que decida el teléfono, y en muchos no
 * abre nada.
 */
export function navigationLinks(point: Coordinates): { waze: string; googleMaps: string } | null {
  if (!isValidCoordinates(point)) return null;

  const lat = roundCoordinate(point.lat);
  const lng = roundCoordinate(point.lng);

  return {
    waze: `https://waze.com/ul?ll=${lat}%2C${lng}&navigate=yes`,
    googleMaps: `https://www.google.com/maps/dir/?api=1&destination=${lat}%2C${lng}`,
  };
}
