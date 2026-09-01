/**
 * Configuración del mapa: proveedor de teselas y estilo.
 *
 * POR QUÉ MAPLIBRE Y NO GOOGLE MAPS
 *
 * Google Maps exige una cuenta de facturación que solo puede crear la dueña del
 * negocio, y hasta que exista no se podría ni probar la pantalla. MapLibre es
 * software libre y no pide nada. Todo lo específico del proveedor vive en este
 * archivo: cambiar a Google el día que interese es tocar aquí, no las pantallas.
 *
 * DOS COSAS DISTINTAS QUE SE CONFUNDEN
 *
 * Una es la **librería** que dibuja el mapa y gestiona el gesto de arrastrar:
 * MapLibre GL, libre y gratis para siempre. Otra son las **teselas**, que son
 * las imágenes del mapa en sí; ésas las sirve alguien, y ahí es donde hay
 * política de uso y, según el proveedor, dinero.
 *
 * SOBRE EL PROVEEDOR POR DEFECTO
 *
 * No son las teselas de `tile.openstreetmap.org`. Su política de uso dice
 * expresamente que no están para aplicaciones de terceros, y bloquean lo que
 * consideran abuso sin avisar: el mapa se queda en blanco y no hay a quién
 * reclamar. Se usa el mapa base de CARTO, construido con los mismos datos de
 * OpenStreetMap y servido sin clave, que sí está pensado para incrustar.
 *
 * Sigue habiendo un límite de uso razonable. Antes de abrir al público de
 * verdad hay que decidir entre contratar un plan (CARTO, MapTiler) o servir las
 * teselas desde el propio R2 con Protomaps, que no añade cuota mensual y es lo
 * que encaja con tener ya Cloudflare pagado. Se cambia con una variable.
 */

export const TILES_URL =
  process.env.NEXT_PUBLIC_MAP_TILES_URL ??
  'https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png';

export const ATTRIBUTION =
  process.env.NEXT_PUBLIC_MAP_ATTRIBUTION ?? '© colaboradores de OpenStreetMap © CARTO';

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
