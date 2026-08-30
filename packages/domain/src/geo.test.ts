import { describe, expect, it } from 'vitest';
import {
  PANAMA_CITY_CENTER,
  findZoneForPoint,
  isLocationPrecision,
  isPointInPolygon,
  isValidCoordinates,
  isWithinPanama,
  navigationLinks,
  parsePolygon,
  roundCoordinate,
  type DeliveryZone,
  type PolygonRing,
} from './geo';

/** Cuadrado de un grado con esquina en (0,0), en orden GeoJSON [lng, lat]. */
const CUADRADO: PolygonRing = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
];

describe('isValidCoordinates', () => {
  it('acepta coordenadas reales', () => {
    expect(isValidCoordinates(PANAMA_CITY_CENTER)).toBe(true);
    expect(isValidCoordinates({ lat: 0, lng: 0 })).toBe(true);
    expect(isValidCoordinates({ lat: -90, lng: -180 })).toBe(true);
    expect(isValidCoordinates({ lat: 90, lng: 180 })).toBe(true);
  });

  it('rechaza lo que está fuera del rango del planeta', () => {
    expect(isValidCoordinates({ lat: 91, lng: 0 })).toBe(false);
    expect(isValidCoordinates({ lat: 0, lng: 181 })).toBe(false);
    expect(isValidCoordinates({ lat: -91, lng: 0 })).toBe(false);
  });

  it('rechaza lo que no es un número', () => {
    expect(isValidCoordinates({ lat: Number.NaN, lng: 0 })).toBe(false);
    expect(isValidCoordinates({ lat: 0, lng: Number.POSITIVE_INFINITY })).toBe(false);
  });
});

describe('isWithinPanama', () => {
  it('reconoce Ciudad de Panamá', () => {
    expect(isWithinPanama(PANAMA_CITY_CENTER)).toBe(true);
  });

  it('reconoce David, en Chiriquí', () => {
    expect(isWithinPanama({ lat: 8.4272, lng: -82.4312 })).toBe(true);
  });

  // El error clásico de todo código que toca mapas.
  it('detecta las coordenadas invertidas', () => {
    const invertido = { lat: PANAMA_CITY_CENTER.lng, lng: PANAMA_CITY_CENTER.lat };
    expect(isWithinPanama(invertido)).toBe(false);
  });

  it('rechaza otros países', () => {
    expect(isWithinPanama({ lat: 4.711, lng: -74.0721 })).toBe(false); // Bogotá
    expect(isWithinPanama({ lat: 40.4168, lng: -3.7038 })).toBe(false); // Madrid
  });

  it('rechaza el (0,0), que es lo que sale de un formulario vacío', () => {
    expect(isWithinPanama({ lat: 0, lng: 0 })).toBe(false);
  });
});

describe('roundCoordinate', () => {
  it('redondea a los siete decimales que guarda la columna', () => {
    expect(roundCoordinate(8.98241234567)).toBe(8.9824123);
    expect(roundCoordinate(-79.51993456789)).toBe(-79.5199346);
  });

  it('no toca lo que ya cabe', () => {
    expect(roundCoordinate(8.9824)).toBe(8.9824);
    expect(roundCoordinate(0)).toBe(0);
  });
});

describe('isPointInPolygon', () => {
  it('reconoce un punto interior', () => {
    expect(isPointInPolygon({ lat: 0.5, lng: 0.5 }, CUADRADO)).toBe(true);
  });

  it('rechaza un punto exterior', () => {
    expect(isPointInPolygon({ lat: 2, lng: 2 }, CUADRADO)).toBe(false);
    expect(isPointInPolygon({ lat: 0.5, lng: -0.5 }, CUADRADO)).toBe(false);
    expect(isPointInPolygon({ lat: -0.5, lng: 0.5 }, CUADRADO)).toBe(false);
  });

  // Si lat y lng se confundieran dentro de la función, este caso pasaría.
  it('no confunde el orden de los ejes', () => {
    const alargado: PolygonRing = [
      [0, 0],
      [10, 0],
      [10, 1],
      [0, 1],
    ];

    // lng 5, lat 0.5: dentro del rectángulo ancho.
    expect(isPointInPolygon({ lat: 0.5, lng: 5 }, alargado)).toBe(true);
    // lng 0.5, lat 5: fuera. Con los ejes cambiados daría true.
    expect(isPointInPolygon({ lat: 5, lng: 0.5 }, alargado)).toBe(false);
  });

  it('funciona con un polígono cóncavo', () => {
    // Una «L».
    const ele: PolygonRing = [
      [0, 0],
      [2, 0],
      [2, 1],
      [1, 1],
      [1, 2],
      [0, 2],
    ];

    expect(isPointInPolygon({ lat: 0.5, lng: 0.5 }, ele)).toBe(true);
    expect(isPointInPolygon({ lat: 1.5, lng: 0.5 }, ele)).toBe(true);
    // El hueco de la L.
    expect(isPointInPolygon({ lat: 1.5, lng: 1.5 }, ele)).toBe(false);
  });

  it('funciona con coordenadas negativas, que es el caso real de Panamá', () => {
    const zona: PolygonRing = [
      [-79.6, 8.9],
      [-79.4, 8.9],
      [-79.4, 9.1],
      [-79.6, 9.1],
    ];

    expect(isPointInPolygon(PANAMA_CITY_CENTER, zona)).toBe(true);
    expect(isPointInPolygon({ lat: 8.4272, lng: -82.4312 }, zona)).toBe(false);
  });

  it('devuelve false con un polígono que no encierra nada', () => {
    expect(isPointInPolygon({ lat: 0.5, lng: 0.5 }, [])).toBe(false);
    expect(isPointInPolygon({ lat: 0.5, lng: 0.5 }, [[0, 0]])).toBe(false);
    expect(
      isPointInPolygon({ lat: 0.5, lng: 0.5 }, [
        [0, 0],
        [1, 1],
      ]),
    ).toBe(false);
  });

  it('devuelve false con un punto inválido', () => {
    expect(isPointInPolygon({ lat: Number.NaN, lng: 0.5 }, CUADRADO)).toBe(false);
  });
});

describe('findZoneForPoint', () => {
  const zonas: DeliveryZone[] = [
    {
      id: 'centro',
      name: 'Centro',
      polygon: CUADRADO,
      shippingPrice: 3,
      handledBy: 'propio',
    },
    {
      id: 'amplia',
      name: 'Área metropolitana',
      polygon: [
        [-1, -1],
        [2, -1],
        [2, 2],
        [-1, 2],
      ],
      shippingPrice: 6,
      handledBy: 'propio',
    },
  ];

  it('encuentra la zona que contiene el punto', () => {
    expect(findZoneForPoint({ lat: 0.5, lng: 0.5 }, zonas)?.id).toBe('centro');
  });

  // Quien configura las zonas decide la prioridad con el orden. Adivinarla aquí
  // haría que el mismo punto cambiara de tarifa sin que nadie tocara nada.
  it('cuando dos zonas se solapan, gana la primera de la lista', () => {
    expect(findZoneForPoint({ lat: 0.5, lng: 0.5 }, zonas)?.shippingPrice).toBe(3);
    expect(findZoneForPoint({ lat: 0.5, lng: 0.5 }, [...zonas].reverse())?.shippingPrice).toBe(6);
  });

  it('cae en la zona amplia cuando el punto no está en el centro', () => {
    expect(findZoneForPoint({ lat: 1.5, lng: 1.5 }, zonas)?.id).toBe('amplia');
  });

  it('devuelve null cuando ninguna zona llega', () => {
    expect(findZoneForPoint({ lat: 50, lng: 50 }, zonas)).toBeNull();
    expect(findZoneForPoint({ lat: 0.5, lng: 0.5 }, [])).toBeNull();
  });
});

describe('parsePolygon', () => {
  it('lee un anillo correcto', () => {
    expect(
      parsePolygon([
        [0, 0],
        [1, 0],
        [1, 1],
      ]),
    ).toEqual([
      [0, 0],
      [1, 0],
      [1, 1],
    ]);
  });

  // Un anillo a medio leer es peor que uno vacío: respondería que sí a puntos
  // que están fuera.
  it('descarta el anillo entero si algún par está mal', () => {
    expect(
      parsePolygon([
        [0, 0],
        [1, 0],
        ['x', 1],
      ]),
    ).toEqual([]);

    expect(parsePolygon([[0, 0], [1], [1, 1]])).toEqual([]);
  });

  it('descarta los anillos que no encierran nada', () => {
    expect(parsePolygon([])).toEqual([]);
    expect(parsePolygon([[0, 0]])).toEqual([]);
    expect(
      parsePolygon([
        [0, 0],
        [1, 1],
      ]),
    ).toEqual([]);
  });

  it('devuelve vacío cuando la columna no tiene un array', () => {
    expect(parsePolygon(null)).toEqual([]);
    expect(parsePolygon(undefined)).toEqual([]);
    expect(parsePolygon({ tipo: 'Polygon' })).toEqual([]);
    expect(parsePolygon('nada')).toEqual([]);
  });
});

describe('navigationLinks', () => {
  it('arma los enlaces de Waze y Google Maps', () => {
    const enlaces = navigationLinks(PANAMA_CITY_CENTER);

    expect(enlaces?.waze).toBe('https://waze.com/ul?ll=8.9824%2C-79.5199&navigate=yes');
    expect(enlaces?.googleMaps).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=8.9824%2C-79.5199',
    );
  });

  it('redondea antes de armar el enlace', () => {
    const enlaces = navigationLinks({ lat: 8.98241234567, lng: -79.51993456789 });

    expect(enlaces?.waze).toContain('8.9824123');
    expect(enlaces?.waze).toContain('-79.5199346');
  });

  it('devuelve null con un punto inválido, en vez de un enlace roto', () => {
    expect(navigationLinks({ lat: Number.NaN, lng: 0 })).toBeNull();
    expect(navigationLinks({ lat: 200, lng: 0 })).toBeNull();
  });
});

describe('isLocationPrecision', () => {
  it('reconoce las cuatro procedencias', () => {
    for (const valor of ['gps', 'pin', 'geocoded', 'manual']) {
      expect(isLocationPrecision(valor)).toBe(true);
    }
  });

  it('rechaza cualquier otra', () => {
    expect(isLocationPrecision('aproximada')).toBe(false);
    expect(isLocationPrecision('')).toBe(false);
  });
});
