'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Map as MapaLibre } from 'maplibre-gl';
import {
  LOCATION_PRECISION_LABELS,
  PANAMA_CITY_CENTER,
  findZoneForPoint,
  isWithinPanama,
  roundCoordinate,
  type Coordinates,
  type DeliveryZone,
  type LocationPrecision,
} from '@nebula/domain';
import { estiloDelMapa } from '@nebula/ui';
import type { LugarEncontrado } from '@/app/api/geo/buscar/route';
import 'maplibre-gl/dist/maplibre-gl.css';

export interface UbicacionElegida {
  lat: number;
  lng: number;
  precision: LocationPrecision;
  reference: string;
  deliveryInstructions: string;
}

/**
 * Dónde hay que entregar, marcado en un mapa.
 *
 * POR QUÉ EXISTE
 *
 * En Panamá la dirección escrita no localiza nada: no hay numeración
 * consistente y el código postal apenas se usa. «Calle 50, edificio azul» es
 * verdad y es inútil. La única referencia dura es la coordenada, y por eso
 * PedidosYa, Uber e inDriver piden un punto en el mapa antes que un texto.
 *
 * EL PIN NO SE ARRASTRA: SE MUEVE EL MAPA
 *
 * El pin está clavado en el centro y lo que se mueve es el mapa debajo. Parece
 * lo mismo y no lo es: arrastrar un pin con el dedo obliga a taparlo con la
 * mano justo cuando hay que verlo, y en un móvil pequeño es la diferencia entre
 * acertar el portón y acertar la manzana.
 *
 * DE DÓNDE SALIÓ EL PUNTO SE GUARDA CON EL PUNTO
 *
 * No es lo mismo una coordenada del GPS del teléfono que una deducida de una
 * búsqueda de texto. Quien prepara el reparto necesita saberlo: una «deducida»
 * merece una llamada antes de mandar a alguien.
 */
export function SelectorDeUbicacion({
  zonas = [],
  valorInicial,
  onCambio,
}: {
  zonas?: readonly DeliveryZone[];
  valorInicial?: Partial<UbicacionElegida>;
  onCambio?: (valor: UbicacionElegida | null) => void;
}) {
  const contenedor = useRef<HTMLDivElement | null>(null);
  const mapa = useRef<MapaLibre | null>(null);

  // Cuando el mapa se mueve por código —una búsqueda, el GPS— el `moveend` que
  // eso dispara no debe marcar el punto como colocado a mano. Se deja aquí la
  // procedencia real y se consume en el siguiente `moveend`.
  const precisionPendiente = useRef<LocationPrecision | null>(null);

  const inicial =
    valorInicial?.lat !== undefined && valorInicial.lng !== undefined
      ? { lat: valorInicial.lat, lng: valorInicial.lng }
      : null;

  const [punto, setPunto] = useState<Coordinates | null>(inicial);
  const [precision, setPrecision] = useState<LocationPrecision | null>(
    inicial ? (valorInicial?.precision ?? 'manual') : null,
  );
  const [referencia, setReferencia] = useState(valorInicial?.reference ?? '');
  const [instrucciones, setInstrucciones] = useState(valorInicial?.deliveryInstructions ?? '');

  const [consulta, setConsulta] = useState('');
  const [resultados, setResultados] = useState<LugarEncontrado[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  // --- El mapa -------------------------------------------------------------
  useEffect(() => {
    if (!contenedor.current || mapa.current) return;

    let cancelado = false;
    let instancia: MapaLibre | null = null;

    // Carga diferida: maplibre pesa, y quien solo mira el carrito no debería
    // descargarlo.
    void import('maplibre-gl').then(({ Map: MapaConstructor, NavigationControl }) => {
      if (cancelado || !contenedor.current) return;

      instancia = new MapaConstructor({
        container: contenedor.current,
        style: estiloDelMapa(),
        center: [punto?.lng ?? PANAMA_CITY_CENTER.lng, punto?.lat ?? PANAMA_CITY_CENTER.lat],
        zoom: punto ? 17 : 12,
        // El mapa es para señalar un portón, no para explorar el mundo.
        attributionControl: { compact: true },
      });

      instancia.addControl(new NavigationControl({ showCompass: false }), 'top-right');

      instancia.on('moveend', () => {
        const centro = instancia?.getCenter();
        if (!centro) return;

        const procedencia = precisionPendiente.current ?? 'pin';
        precisionPendiente.current = null;

        setPunto({ lat: roundCoordinate(centro.lat), lng: roundCoordinate(centro.lng) });
        setPrecision(procedencia);
      });

      mapa.current = instancia;
    });

    return () => {
      cancelado = true;
      instancia?.remove();
      mapa.current = null;
    };
    // Se monta una sola vez: el punto inicial ya va en `center`, y volver a
    // ejecutarlo con cada cambio destruiría el mapa mientras se usa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Lo que se le devuelve al formulario ---------------------------------
  useEffect(() => {
    if (!punto || !precision) {
      onCambio?.(null);
      return;
    }

    onCambio?.({
      lat: punto.lat,
      lng: punto.lng,
      precision,
      reference: referencia.trim(),
      deliveryInstructions: instrucciones.trim(),
    });
  }, [punto, precision, referencia, instrucciones, onCambio]);

  const volar = useCallback((destino: Coordinates, procedencia: LocationPrecision) => {
    precisionPendiente.current = procedencia;
    mapa.current?.flyTo({ center: [destino.lng, destino.lat], zoom: 17, duration: 900 });

    // Si el mapa aún no cargó, el `flyTo` se pierde. El punto se fija igual:
    // vale más una coordenada sin animación que ninguna.
    if (!mapa.current) {
      setPunto({ lat: roundCoordinate(destino.lat), lng: roundCoordinate(destino.lng) });
      setPrecision(procedencia);
    }
  }, []);

  // --- Buscador ------------------------------------------------------------
  useEffect(() => {
    const texto = consulta.trim();
    // Con menos de tres letras no se busca. No se limpian aquí los resultados
    // anteriores: eso lo decide el render, más abajo, a partir del propio texto.
    if (texto.length < 3) return;

    const controlador = new AbortController();
    const temporizador = window.setTimeout(() => {
      setBuscando(true);

      void fetch(`/api/geo/buscar?q=${encodeURIComponent(texto)}`, {
        signal: controlador.signal,
      })
        .then((r) => (r.ok ? (r.json() as Promise<{ resultados: LugarEncontrado[] }>) : null))
        .then((datos) => setResultados(datos?.resultados ?? []))
        .catch(() => setResultados([]))
        .finally(() => setBuscando(false));
    }, 450);

    return () => {
      window.clearTimeout(temporizador);
      controlador.abort();
    };
  }, [consulta]);

  function usarMiUbicacion() {
    setAviso(null);

    if (!('geolocation' in navigator)) {
      setAviso('Este navegador no puede darnos tu ubicación. Búscala o márcala en el mapa.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (posicion) => {
        volar({ lat: posicion.coords.latitude, lng: posicion.coords.longitude }, 'gps');
      },
      (error) => {
        setAviso(
          error.code === error.PERMISSION_DENIED
            ? 'No nos diste permiso de ubicación. Puedes buscarla o marcarla en el mapa.'
            : 'No pudimos obtener tu ubicación. Búscala o márcala en el mapa.',
        );
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  // Las sugerencias se derivan del texto, no de un estado que haya que limpiar:
  // así vaciar el buscador las hace desaparecer sin un efecto de por medio.
  const sugerencias = consulta.trim().length >= 3 ? resultados : [];

  const zona = punto ? findZoneForPoint(punto, zonas) : null;
  const fueraDePanama = punto ? !isWithinPanama(punto) : false;

  return (
    <div className="ubicacion">
      <div className="ubicacion-buscador">
        <input
          type="search"
          value={consulta}
          onChange={(evento) => setConsulta(evento.target.value)}
          placeholder="Busca tu calle, barriada o un punto de referencia"
          aria-label="Buscar la dirección"
          autoComplete="off"
        />

        {sugerencias.length > 0 ? (
          <ul className="ubicacion-sugerencias">
            {sugerencias.map((lugar) => (
              <li key={`${lugar.lat},${lugar.lng}`}>
                <button
                  type="button"
                  onClick={() => {
                    volar({ lat: lugar.lat, lng: lugar.lng }, 'geocoded');
                    setConsulta('');
                  }}
                >
                  {lugar.etiqueta}
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {buscando ? <span className="field-hint">Buscando…</span> : null}
      </div>

      <div className="ubicacion-mapa">
        <div ref={contenedor} className="ubicacion-lienzo" />

        {/* El pin va fuera del mapa y clavado en el centro: es lo que hace que
            se mueva el mapa y no el pin. */}
        <span className="ubicacion-pin" aria-hidden="true" />

        <button type="button" className="btn btn-outline btn-sm ubicacion-gps" onClick={usarMiUbicacion}>
          Usar mi ubicación
        </button>
      </div>

      <p className="field-hint ubicacion-estado" role="status">
        {punto && precision
          ? `Punto marcado · ${LOCATION_PRECISION_LABELS[precision]}`
          : 'Mueve el mapa hasta el punto exacto de entrega, o busca la dirección arriba.'}
      </p>

      {fueraDePanama ? (
        <div className="notice notice-error">
          Ese punto está fuera de Panamá. Revísalo antes de continuar.
        </div>
      ) : null}

      {punto && !fueraDePanama && zonas.length > 0 ? (
        zona ? (
          <div className="notice notice-success">
            Repartimos en esta zona: <strong>{zona.name}</strong>
            {zona.shippingPrice !== null ? ` · envío $${zona.shippingPrice.toFixed(2)}` : ''}
          </div>
        ) : (
          <div className="notice notice-info">
            Todavía no repartimos hasta ahí con reparto propio. Puedes seguir con el pedido y lo
            enviamos por courier.
          </div>
        )
      ) : null}

      {aviso ? <p className="field-error">{aviso}</p> : null}

      <div className="field">
        <label htmlFor="reference">Cómo reconocer el sitio</label>
        <input
          id="reference"
          name="reference"
          value={referencia}
          onChange={(evento) => setReferencia(evento.target.value)}
          maxLength={200}
          placeholder="Portón negro, al lado de la farmacia"
        />
        <span className="field-hint">
          Es lo que de verdad usa quien entrega cuando llega a la esquina.
        </span>
      </div>

      <div className="field">
        <label htmlFor="deliveryInstructions">Qué hacer al llegar (opcional)</label>
        <input
          id="deliveryInstructions"
          name="deliveryInstructions"
          value={instrucciones}
          onChange={(evento) => setInstrucciones(evento.target.value)}
          maxLength={200}
          placeholder="Llamar antes · dejar en portería"
        />
      </div>

      {/* Para formularios que se envían sin JavaScript de por medio. */}
      <input type="hidden" name="latitude" value={punto?.lat ?? ''} />
      <input type="hidden" name="longitude" value={punto?.lng ?? ''} />
      <input type="hidden" name="locationPrecision" value={precision ?? ''} />
    </div>
  );
}
