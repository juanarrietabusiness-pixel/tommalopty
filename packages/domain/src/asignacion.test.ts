import { describe, expect, it } from 'vitest';
import {
  KM_POR_ENTREGA_PENDIENTE,
  MAX_ENTREGAS_POR_MOTORIZADO,
  mejorCandidato,
  sugerirMotorizado,
  type MotorizadoDisponible,
} from './asignacion';
import type { Coordinates, DeliveryZone } from './geo';

const SAN_FRANCISCO: Coordinates = { lat: 8.985, lng: -79.51 };
const LEJOS: Coordinates = { lat: 9.05, lng: -79.42 };

/** Un cuadrado alrededor de San Francisco, en orden GeoJSON [lng, lat]. */
const ZONA_SF: DeliveryZone = {
  id: 'zona-sf',
  name: 'San Francisco',
  polygon: [
    [-79.53, 8.97],
    [-79.49, 8.97],
    [-79.49, 9.0],
    [-79.53, 9.0],
  ],
  shippingPrice: 3,
  handledBy: 'propio',
};

function moto(extra: Partial<MotorizadoDisponible> & { id: string }): MotorizadoDisponible {
  return {
    nombre: extra.id,
    estado: 'activo',
    zoneIds: [],
    entregasPendientes: [],
    ...extra,
  };
}

describe('sugerirMotorizado', () => {
  it('quien cubre la zona va primero, aunque el otro esté más cerca', () => {
    const candidatos = sugerirMotorizado(
      SAN_FRANCISCO,
      [
        // Este tiene una entrega justo al lado, pero no cubre la zona.
        moto({ id: 'cercano', entregasPendientes: [SAN_FRANCISCO] }),
        // Este cubre la zona y va vacío.
        moto({ id: 'deLaZona', zoneIds: ['zona-sf'] }),
      ],
      [ZONA_SF],
    );

    expect(candidatos[0]?.motorizadoId).toBe('deLaZona');
    expect(candidatos[0]?.cubreLaZona).toBe(true);
  });

  it('entre dos que cubren la zona, gana el que tiene entregas cerca', () => {
    const candidatos = sugerirMotorizado(
      SAN_FRANCISCO,
      [
        moto({ id: 'lejos', zoneIds: ['zona-sf'], entregasPendientes: [LEJOS] }),
        moto({ id: 'cerca', zoneIds: ['zona-sf'], entregasPendientes: [SAN_FRANCISCO] }),
      ],
      [ZONA_SF],
    );

    expect(candidatos[0]?.motorizadoId).toBe('cerca');
  });

  /*
   * La regla que hace que el peso no sea un número mágico: cada entrega pendiente
   * cuesta `KM_POR_ENTREGA_PENDIENTE` kilómetros. Con el valor por defecto de 2,
   * alguien con tres entregas encima arrastra 6 km de penalización, así que
   * pierde contra alguien vacío que esté a 3 km.
   */
  it('la carga se paga en kilómetros, y por eso puede perder contra alguien más lejos', () => {
    const treKmAlNorte: Coordinates = { lat: SAN_FRANCISCO.lat + 3 / 111, lng: SAN_FRANCISCO.lng };

    const candidatos = sugerirMotorizado(
      SAN_FRANCISCO,
      [
        moto({
          id: 'pegado',
          zoneIds: ['zona-sf'],
          entregasPendientes: [SAN_FRANCISCO, SAN_FRANCISCO, SAN_FRANCISCO],
        }),
        moto({ id: 'aTresKm', zoneIds: ['zona-sf'], entregasPendientes: [treKmAlNorte] }),
      ],
      [ZONA_SF],
    );

    // «pegado»: 0 km + 3 × 2 = 6. «aTresKm»: ~3 km + 1 × 2 = ~5.
    expect(candidatos[0]?.motorizadoId).toBe('aTresKm');
    expect(KM_POR_ENTREGA_PENDIENTE).toBe(2);
  });

  it('quien va vacío no queda penalizado por no tener grupo', () => {
    const candidatos = sugerirMotorizado(
      SAN_FRANCISCO,
      [
        moto({ id: 'vacio', zoneIds: ['zona-sf'] }),
        moto({ id: 'conUna', zoneIds: ['zona-sf'], entregasPendientes: [SAN_FRANCISCO] }),
      ],
      [ZONA_SF],
    );

    expect(candidatos[0]?.motorizadoId).toBe('vacio');
    expect(candidatos[0]?.kmAlGrupo).toBeNull();
  });

  describe('a quién no se le propone', () => {
    it('a quien está en pausa', () => {
      const candidatos = sugerirMotorizado(
        SAN_FRANCISCO,
        [moto({ id: 'enPausa', estado: 'pausa', zoneIds: ['zona-sf'] })],
        [ZONA_SF],
      );

      expect(candidatos[0]?.proponible).toBe(false);
      expect(mejorCandidato(candidatos)).toBeNull();
    });

    it('a quien está inactivo', () => {
      const candidatos = sugerirMotorizado(
        SAN_FRANCISCO,
        [moto({ id: 'inactivo', estado: 'inactivo' })],
        [ZONA_SF],
      );
      expect(candidatos[0]?.proponible).toBe(false);
    });

    it('a quien está saturado, por cerca que esté', () => {
      const candidatos = sugerirMotorizado(
        SAN_FRANCISCO,
        [
          moto({
            id: 'saturado',
            zoneIds: ['zona-sf'],
            entregasPendientes: Array.from(
              { length: MAX_ENTREGAS_POR_MOTORIZADO },
              () => SAN_FRANCISCO,
            ),
          }),
          moto({ id: 'libre' }),
        ],
        [ZONA_SF],
      );

      expect(mejorCandidato(candidatos)?.motorizadoId).toBe('libre');
    });

    /*
     * Los que no se pueden proponer salen igual, al final y con su motivo. Que la
     * pantalla pueda decir «a este no, porque está en pausa» vale tanto como la
     * propuesta: sin eso, quien despacha se pregunta dónde está fulano.
     */
    it('pero salen todos igualmente, al final y con su motivo', () => {
      const candidatos = sugerirMotorizado(
        SAN_FRANCISCO,
        [moto({ id: 'enPausa', estado: 'pausa' }), moto({ id: 'activo' })],
        [ZONA_SF],
      );

      expect(candidatos).toHaveLength(2);
      expect(candidatos[1]?.motorizadoId).toBe('enPausa');
      expect(candidatos[1]?.motivo).toMatch(/no está activo/i);
    });
  });

  describe('sin coordenada', () => {
    /*
     * Un envío sin punto en el mapa no se puede acercar a nadie ni situar en una
     * zona. Queda el que menos lleve, que es poco — y es lo honesto.
     */
    it('ordena por carga, porque no hay más información', () => {
      const candidatos = sugerirMotorizado(
        null,
        [
          moto({ id: 'ocupado', entregasPendientes: [SAN_FRANCISCO, LEJOS] }),
          moto({ id: 'libre' }),
        ],
        [ZONA_SF],
      );

      expect(candidatos[0]?.motorizadoId).toBe('libre');
      expect(candidatos[0]?.cubreLaZona).toBe(false);
    });
  });

  it('sin motorizados no revienta', () => {
    expect(sugerirMotorizado(SAN_FRANCISCO, [], [ZONA_SF])).toEqual([]);
    expect(mejorCandidato([])).toBeNull();
  });

  it('un destino fuera de toda zona deja a todos sin cobertura, y sigue ordenando', () => {
    const candidatos = sugerirMotorizado(
      LEJOS,
      [moto({ id: 'a', zoneIds: ['zona-sf'] }), moto({ id: 'b' })],
      [ZONA_SF],
    );

    expect(candidatos.every((c) => !c.cubreLaZona)).toBe(true);
    expect(candidatos).toHaveLength(2);
  });

  /*
   * Sin desempate estable, dos candidatos idénticos pueden salir en distinto
   * orden entre recargas y la pantalla parece que cambia de opinión sola.
   */
  it('empata siempre igual, para que el orden no baile entre recargas', () => {
    const motos = [moto({ id: 'b', nombre: 'Beto' }), moto({ id: 'a', nombre: 'Ana' })];

    const primera = sugerirMotorizado(SAN_FRANCISCO, motos, [ZONA_SF]);
    const segunda = sugerirMotorizado(SAN_FRANCISCO, [...motos].reverse(), [ZONA_SF]);

    expect(primera.map((c) => c.nombre)).toEqual(segunda.map((c) => c.nombre));
    expect(primera[0]?.nombre).toBe('Ana');
  });
});
