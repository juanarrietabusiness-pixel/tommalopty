'use client';

import { useEffect, useRef, useState } from 'react';
import type { Map as MapaLibre } from 'maplibre-gl';
import { PANAMA_CITY_CENTER } from '@nebula/domain';
import { estiloDelMapa } from '@nebula/ui';
import 'maplibre-gl/dist/maplibre-gl.css';

type Vertice = [number, number];

/**
 * Dibuja el área de una zona de reparto tocando el mapa.
 *
 * Se toca para añadir un vértice, y el área se cierra sola: no hay que volver
 * al primer punto. Cerrar un polígono a mano es la parte que todo el mundo hace
 * mal, y un anillo mal cerrado no da error al guardar — da entregas aceptadas
 * en direcciones a las que no se llega.
 *
 * El anillo va en orden GeoJSON, `[lng, lat]`, que es como lo lee la tienda.
 * Mezclar las dos convenciones es el error clásico de todo código que toca
 * mapas, y por eso aquí no se usan nombres: solo posiciones.
 */
export function ZoneMap({ valorInicial = [] }: { valorInicial?: Vertice[] }) {
  const contenedor = useRef<HTMLDivElement | null>(null);
  const mapa = useRef<MapaLibre | null>(null);
  const [vertices, setVertices] = useState<Vertice[]>(valorInicial);

  // El mapa se monta una sola vez y sus capas no existen hasta que termina de
  // cargar. Este estado es lo que deja que el efecto de pintado espere sin
  // tener que leer nada desde dentro del propio montaje.
  const [mapaListo, setMapaListo] = useState(false);

  useEffect(() => {
    if (!contenedor.current || mapa.current) return;

    let cancelado = false;
    let instancia: MapaLibre | null = null;

    void import('maplibre-gl').then(({ Map: MapaConstructor, NavigationControl }) => {
      if (cancelado || !contenedor.current) return;

      const centro = valorInicial[0] ?? [PANAMA_CITY_CENTER.lng, PANAMA_CITY_CENTER.lat];

      instancia = new MapaConstructor({
        container: contenedor.current,
        style: estiloDelMapa(),
        center: centro,
        zoom: valorInicial.length > 0 ? 12 : 11,
        attributionControl: { compact: true },
      });

      instancia.addControl(new NavigationControl({ showCompass: false }), 'top-right');

      instancia.on('click', (evento) => {
        setVertices((previos) => [...previos, [evento.lngLat.lng, evento.lngLat.lat]]);
      });

      instancia.on('load', () => {
        if (!instancia) return;

        instancia.addSource('zona', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });

        instancia.addLayer({
          id: 'zona-relleno',
          type: 'fill',
          source: 'zona',
          paint: { 'fill-color': '#173c2e', 'fill-opacity': 0.18 },
        });

        instancia.addLayer({
          id: 'zona-borde',
          type: 'line',
          source: 'zona',
          paint: { 'line-color': '#173c2e', 'line-width': 2 },
        });

        instancia.addLayer({
          id: 'zona-vertices',
          type: 'circle',
          source: 'zona',
          filter: ['==', '$type', 'Point'],
          paint: {
            'circle-radius': 5,
            'circle-color': '#ff5a1f',
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff',
          },
        });

        mapa.current = instancia;
        setMapaListo(true);
      });
    });

    return () => {
      cancelado = true;
      instancia?.remove();
      mapa.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (mapaListo && mapa.current) pintar(mapa.current, vertices);
  }, [vertices, mapaListo]);

  return (
    <div className="zona-editor">
      <div ref={contenedor} className="zona-mapa" />

      <div className="zona-controles">
        <span className="field-hint">
          {vertices.length === 0
            ? 'Toca el mapa para marcar las esquinas del área. Se cierra sola.'
            : `${vertices.length} ${vertices.length === 1 ? 'punto' : 'puntos'} marcados${
                vertices.length < 3 ? ' · hacen falta al menos tres' : ''
              }`}
        </span>

        <div className="zona-botones">
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => setVertices((previos) => previos.slice(0, -1))}
            disabled={vertices.length === 0}
          >
            Deshacer punto
          </button>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => setVertices([])}
            disabled={vertices.length === 0}
          >
            Empezar de nuevo
          </button>
        </div>
      </div>

      {/* Lo que se envía. El campo va aquí y no en el formulario padre para que
          el área y su representación no puedan separarse. */}
      <input type="hidden" name="polygon" value={JSON.stringify(vertices)} />
    </div>
  );
}

/**
 * Repinta el área.
 *
 * El anillo del polígono se cierra repitiendo el primer punto al final, que es
 * lo que exige GeoJSON. En la base **no** se guarda repetido: `parsePolygon` y
 * el cálculo de punto-en-polígono tratan el anillo como cerrado por definición,
 * y guardar el punto extra haría que el mismo área tuviera dos formas de
 * escribirse.
 */
function pintar(mapa: MapaLibre, vertices: Vertice[]) {
  const fuente = mapa.getSource('zona');
  if (!fuente || !('setData' in fuente)) return;

  const puntos = vertices.map((posicion) => ({
    type: 'Feature' as const,
    properties: {},
    geometry: { type: 'Point' as const, coordinates: posicion },
  }));

  const area =
    vertices.length >= 3
      ? [
          {
            type: 'Feature' as const,
            properties: {},
            geometry: {
              type: 'Polygon' as const,
              coordinates: [[...vertices, vertices[0] as Vertice]],
            },
          },
        ]
      : [];

  (fuente as { setData: (datos: unknown) => void }).setData({
    type: 'FeatureCollection',
    features: [...area, ...puntos],
  });
}
