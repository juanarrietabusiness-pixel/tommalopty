/**
 * Configuración del mapa de la tienda.
 *
 * POR QUÉ MAPLIBRE Y NO GOOGLE MAPS
 *
 * Google Maps exige una cuenta de facturación que solo puede crear la dueña del
 * negocio, y hasta que exista no se podría ni probar la pantalla. MapLibre con
 * teselas de OpenStreetMap no pide nada. Todo lo específico del proveedor vive
 * en este archivo: cambiar a Google el día que interese es tocar aquí, no las
 * pantallas.
 *
 * SOBRE LAS TESELAS
 *
 * El valor por defecto son las teselas públicas de OpenStreetMap, que sirven
 * para desarrollo y para enseñar la pantalla, pero **su política de uso no cubre
 * una tienda en producción**. Antes de abrir hay que apuntar
 * `NEXT_PUBLIC_MAP_TILES_URL` a un proveedor con plan: MapTiler, CARTO, o
 * Protomaps servido desde el propio R2 —esta última no añade cuota mensual, que
 * es lo que encaja con tener ya Cloudflare pagado—.
 */

export const TILES_URL =
  process.env.NEXT_PUBLIC_MAP_TILES_URL ?? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

export const ATTRIBUTION =
  process.env.NEXT_PUBLIC_MAP_ATTRIBUTION ?? '© colaboradores de OpenStreetMap';

/**
 * Estilo mínimo de MapLibre: una sola capa ráster.
 *
 * Se construye a mano en lugar de descargar un JSON de estilo porque así el
 * mapa no depende de una segunda petición a un tercero para pintarse.
 *
 * El tipo se declara aquí en vez de importarlo de `maplibre-gl`: este paquete
 * lo comparten la tienda y el panel, y no debe arrastrar la librería del mapa a
 * quien solo quiera un botón.
 */
export interface EstiloRaster {
  version: 8;
  sources: Record<
    string,
    { type: 'raster'; tiles: string[]; tileSize: number; attribution: string }
  >;
  layers: { id: string; type: 'raster'; source: string }[];
}

export function estiloDelMapa(): EstiloRaster {
  return {
    version: 8,
    sources: {
      base: {
        type: 'raster',
        tiles: [TILES_URL],
        tileSize: 256,
        attribution: ATTRIBUTION,
      },
    },
    layers: [{ id: 'base', type: 'raster', source: 'base' }],
  };
}
