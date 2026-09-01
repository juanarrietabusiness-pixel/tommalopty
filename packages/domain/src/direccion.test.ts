import { describe, expect, it } from 'vitest';
import {
  normalizarProvincia,
  repartirDireccion,
  tieneAlgoQueRellenar,
  type PartesDeDireccion,
} from './direccion';

/**
 * Los ejemplos son respuestas reales de Nominatim recortadas a lo que se usa.
 * Cuando una dirección panameña salga mal repartida, el arreglo empieza por
 * pegar aquí su respuesta.
 */
const CALLE_50: PartesDeDireccion = {
  house_number: '55',
  road: 'Calle 50',
  suburb: 'Bella Vista',
  city: 'Bella Vista',
  county: 'Distrito de Panamá',
  state: 'Provincia de Panamá',
  country_code: 'pa',
};

const SIN_CALLE: PartesDeDireccion = {
  neighbourhood: 'Altos de Cerro Viento',
  county: 'Distrito de San Miguelito',
  state: 'Provincia de Panamá',
  country_code: 'pa',
};

describe('repartirDireccion', () => {
  it('junta la calle con su número en la dirección', () => {
    expect(repartirDireccion(CALLE_50, 'Calle 50 55, Bella Vista').line1).toBe('Calle 50 55');
  });

  it('quita el «Provincia de» y el «Distrito de»', () => {
    const direccion = repartirDireccion(CALLE_50, 'Calle 50 55, Bella Vista');
    expect(direccion.province).toBe('Panamá');
    expect(direccion.city).toBe('Bella Vista');
  });

  it('usa el barrio como dirección cuando no hay calle', () => {
    const direccion = repartirDireccion(SIN_CALLE, 'Altos de Cerro Viento');
    expect(direccion.line1).toBe('Altos de Cerro Viento');
    // Y entonces no lo repite en la ciudad: cae al distrito.
    expect(direccion.city).toBe('San Miguelito');
  });

  it('no deja el mismo texto en dirección y ciudad', () => {
    const direccion = repartirDireccion(
      { neighbourhood: 'Chorrillo', county: 'Distrito de Panamá', state: 'Panamá' },
      'Chorrillo',
    );
    expect(direccion.line1).not.toBe(direccion.city);
  });

  it('sube el barrio a ciudad cuando sí hay calle y no hay ciudad', () => {
    const direccion = repartirDireccion(
      { road: 'Vía Porras', suburb: 'San Francisco', state: 'Panamá' },
      'Vía Porras, San Francisco',
    );
    expect(direccion.line1).toBe('Vía Porras');
    expect(direccion.city).toBe('San Francisco');
  });

  it('devuelve campos vacíos en vez de inventarlos', () => {
    const direccion = repartirDireccion(undefined, '');
    expect(direccion).toEqual({ line1: '', city: '', province: '', etiqueta: '' });
  });

  it('guarda la etiqueta completa para poder enseñarla', () => {
    expect(repartirDireccion(CALLE_50, '  Calle 50, Bella Vista, Panamá  ').etiqueta).toBe(
      'Calle 50, Bella Vista, Panamá',
    );
  });
});

describe('normalizarProvincia', () => {
  it('reconoce la provincia aunque venga sin tildes o en minúsculas', () => {
    expect(normalizarProvincia('provincia de chiriqui')).toBe('Chiriquí');
    expect(normalizarProvincia('COCLE')).toBe('Coclé');
  });

  it('respeta lo que no conoce en vez de vaciarlo', () => {
    expect(normalizarProvincia('Comarca Nueva')).toBe('Nueva');
    expect(normalizarProvincia('Guna Yala')).toBe('Guna Yala');
  });

  it('devuelve vacío cuando no llega nada', () => {
    expect(normalizarProvincia('   ')).toBe('');
  });
});

describe('tieneAlgoQueRellenar', () => {
  it('distingue una dirección vacía de una con un solo campo', () => {
    expect(tieneAlgoQueRellenar({ line1: '', city: '', province: '', etiqueta: 'x' })).toBe(false);
    expect(tieneAlgoQueRellenar({ line1: '', city: 'Colón', province: '', etiqueta: '' })).toBe(
      true,
    );
  });
});
