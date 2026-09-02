import { describe, expect, it } from 'vitest';
import { ahorroDeLaRuta, distanciaKm, proponerRuta, type Parada } from './rutas';
import { PANAMA_CITY_CENTER, type Coordinates } from './geo';

/** Un punto a `km` kilómetros al este del centro de Panamá, aproximado. */
function alEste(km: number): Coordinates {
  // A 9° de latitud, un grado de longitud son unos 110 km.
  return { lat: PANAMA_CITY_CENTER.lat, lng: PANAMA_CITY_CENTER.lng + km / 110 };
}

function parada(id: string, punto: Coordinates | null): Parada {
  return { id, punto };
}

describe('distanciaKm', () => {
  it('un punto consigo mismo son cero kilómetros', () => {
    expect(distanciaKm(PANAMA_CITY_CENTER, PANAMA_CITY_CENTER)).toBe(0);
  });

  /*
   * Ciudad de Panamá a Colón son unos 55 km en línea recta. No se fija el número
   * exacto —depende del punto que se tome de cada ciudad— sino el orden de
   * magnitud: es lo que detecta un error de unidades o de radianes, que es el
   * fallo real de esta función.
   */
  it('da kilómetros y no grados ni metros', () => {
    const colon: Coordinates = { lat: 9.3592, lng: -79.9014 };
    const d = distanciaKm(PANAMA_CITY_CENTER, colon);

    expect(d).toBeGreaterThan(45);
    expect(d).toBeLessThan(70);
  });

  it('es simétrica', () => {
    const a = alEste(3);
    expect(distanciaKm(PANAMA_CITY_CENTER, a)).toBeCloseTo(distanciaKm(a, PANAMA_CITY_CENTER), 9);
  });

  it('una coordenada inválida da infinito, no un número que engañe', () => {
    expect(distanciaKm(PANAMA_CITY_CENTER, { lat: Number.NaN, lng: 0 })).toBe(
      Number.POSITIVE_INFINITY,
    );
  });
});

describe('proponerRuta', () => {
  /*
   * El caso que justifica todo: cuatro paradas en línea, entregadas en el peor
   * orden posible. Un humano con la lista en la mano las haría así; la propuesta
   * tiene que ponerlas en fila.
   */
  it('ordena en fila lo que llegó desordenado', () => {
    const ruta = proponerRuta(PANAMA_CITY_CENTER, [
      parada('lejos', alEste(8)),
      parada('cerca', alEste(1)),
      parada('medio', alEste(4)),
      parada('masLejos', alEste(12)),
    ]);

    expect(ruta.orden.map((p) => p.id)).toEqual(['cerca', 'medio', 'lejos', 'masLejos']);
  });

  it('el orden propuesto nunca es peor que el que llegó', () => {
    const ruta = proponerRuta(PANAMA_CITY_CENTER, [
      parada('a', alEste(8)),
      parada('b', alEste(1)),
      parada('c', alEste(4)),
      parada('d', alEste(12)),
    ]);

    expect(ruta.distanciaKm).toBeLessThanOrEqual(ruta.distanciaOriginalKm + 1e-9);
  });

  /*
   * EL CASO QUE JUSTIFICA EL 2-OPT, Y NO ESTÁ INVENTADO
   *
   * El vecino más cercano arrastra sus decisiones tempranas: se lleva lo que
   * tiene al lado y deja una parada abandonada lejos, que luego obliga a un
   * viaje largo al final. Estas seis coordenadas de Ciudad de Panamá son un caso
   * de esos, **encontrado buscándolo** sobre miles de combinaciones y no elegido
   * a mano: solo con vecino más cercano el recorrido mide 25,7 km, y deshaciendo
   * los cruces baja a 18,2. Casi treinta por ciento.
   *
   * Importa que sea un caso real: el primer test que se escribió aquí usaba un
   * cuadrado, y pasaba en verde **con el 2-opt desactivado** — porque el vecino
   * más cercano ya resuelve un cuadrado. Un test que no puede fallar no prueba
   * nada, y este proyecto ya pagó esa lección con el mapa.
   */
  it('deshace los cruces que el vecino más cercano deja, y se nota', () => {
    const dificil = [
      parada('a', { lat: 8.9895, lng: -79.547 }),
      parada('b', { lat: 8.9816, lng: -79.5208 }),
      parada('c', { lat: 8.9793, lng: -79.4917 }),
      parada('d', { lat: 9.0148, lng: -79.4809 }),
      parada('e', { lat: 8.95, lng: -79.4899 }),
      parada('f', { lat: 8.9621, lng: -79.5119 }),
    ];

    const ruta = proponerRuta({ lat: 9.0, lng: -79.5 }, dificil);

    // 18,2 km con los cruces deshechos; 25,7 sin ellos. El umbral va en medio
    // para que el test hable de la diferencia y no de un decimal.
    expect(ruta.distanciaKm).toBeLessThan(22);
  });

  /*
   * Las paradas sin coordenada no son «la última entrega»: son un problema de
   * datos. Quien reparte va a tener que llamar por teléfono, y eso se planifica
   * distinto que una parada más al final de la fila.
   */
  it('aparta las paradas sin punto en el mapa en vez de ponerlas al final', () => {
    const ruta = proponerRuta(PANAMA_CITY_CENTER, [
      parada('conPunto', alEste(2)),
      parada('sinPunto', null),
    ]);

    expect(ruta.orden.map((p) => p.id)).toEqual(['conPunto']);
    expect(ruta.sinUbicar.map((p) => p.id)).toEqual(['sinPunto']);
  });

  it('una coordenada rota cuenta como sin ubicar', () => {
    const ruta = proponerRuta(PANAMA_CITY_CENTER, [parada('rota', { lat: 999, lng: 0 })]);
    expect(ruta.sinUbicar.map((p) => p.id)).toEqual(['rota']);
  });

  it('sin paradas devuelve una ruta vacía y no revienta', () => {
    const ruta = proponerRuta(PANAMA_CITY_CENTER, []);
    expect(ruta.orden).toEqual([]);
    expect(ruta.distanciaKm).toBe(0);
  });

  it('con una sola parada el orden es esa parada', () => {
    const ruta = proponerRuta(PANAMA_CITY_CENTER, [parada('unica', alEste(3))]);
    expect(ruta.orden.map((p) => p.id)).toEqual(['unica']);
  });

  it('no pierde ni duplica paradas', () => {
    const paradas = [
      parada('a', alEste(5)),
      parada('b', alEste(2)),
      parada('c', null),
      parada('d', alEste(9)),
    ];

    const ruta = proponerRuta(PANAMA_CITY_CENTER, paradas);
    const salieron = [...ruta.orden, ...ruta.sinUbicar].map((p) => p.id).sort();

    expect(salieron).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('ahorroDeLaRuta', () => {
  it('mide lo que se ahorra en kilómetros y en porcentaje', () => {
    const ruta = proponerRuta(PANAMA_CITY_CENTER, [
      parada('lejos', alEste(10)),
      parada('cerca', alEste(1)),
    ]);

    const ahorro = ahorroDeLaRuta(ruta);
    expect(ahorro.km).toBeGreaterThan(0);
    expect(ahorro.porcentaje).toBeGreaterThan(0);
  });

  it('con el orden ya óptimo el ahorro es cero, no negativo', () => {
    const ruta = proponerRuta(PANAMA_CITY_CENTER, [
      parada('cerca', alEste(1)),
      parada('lejos', alEste(5)),
    ]);

    expect(ahorroDeLaRuta(ruta).km).toBeCloseTo(0, 6);
  });

  it('sin paradas no divide por cero', () => {
    expect(ahorroDeLaRuta(proponerRuta(PANAMA_CITY_CENTER, [])).porcentaje).toBe(0);
  });
});
