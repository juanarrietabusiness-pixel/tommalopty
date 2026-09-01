import { describe, expect, it } from 'vitest';
import {
  documentosPorVencer,
  isEstadoMotorizado,
  isVehiculo,
  puedeEntrar,
  puedeRecibirEntregas,
} from './motorizado';

describe('estados del motorizado', () => {
  /*
   * La distinción entre pausa e inactivo es la razón de que existan tres
   * estados y no dos, así que se fija con un test: pausar a alguien a media
   * tarde no puede dejarle tres paquetes sin poder marcar entregados.
   */
  it('quien está en pausa no recibe entregas nuevas pero sí entra a cerrar las suyas', () => {
    expect(puedeRecibirEntregas('pausa')).toBe(false);
    expect(puedeEntrar('pausa')).toBe(true);
  });

  it('quien está inactivo no entra', () => {
    expect(puedeRecibirEntregas('inactivo')).toBe(false);
    expect(puedeEntrar('inactivo')).toBe(false);
  });

  it('quien está activo hace las dos cosas', () => {
    expect(puedeRecibirEntregas('activo')).toBe(true);
    expect(puedeEntrar('activo')).toBe(true);
  });

  it('reconoce lo que es y rechaza lo que no', () => {
    expect(isEstadoMotorizado('pausa')).toBe(true);
    expect(isEstadoMotorizado('vacaciones')).toBe(false);
    expect(isVehiculo('moto')).toBe(true);
    expect(isVehiculo('camión')).toBe(false);
  });
});

describe('documentosPorVencer', () => {
  const HOY = '2026-09-01';

  it('avisa de lo que vence dentro del plazo', () => {
    const avisos = documentosPorVencer([{ tipo: 'licencia', vence: '2026-09-20' }], HOY);
    expect(avisos).toHaveLength(1);
    expect(avisos[0]?.diasRestantes).toBe(19);
  });

  it('no avisa de lo que queda lejos', () => {
    expect(documentosPorVencer([{ tipo: 'seguro', vence: '2027-01-01' }], HOY)).toHaveLength(0);
  });

  it('lo ya vencido sale con días negativos, no desaparece', () => {
    const avisos = documentosPorVencer([{ tipo: 'licencia', vence: '2026-08-01' }], HOY);
    expect(avisos[0]?.diasRestantes).toBe(-31);
  });

  it('pone lo más urgente primero', () => {
    const avisos = documentosPorVencer(
      [
        { tipo: 'seguro', vence: '2026-09-25' },
        { tipo: 'licencia', vence: '2026-08-15' },
      ],
      HOY,
    );
    expect(avisos.map((a) => a.documento.tipo)).toEqual(['licencia', 'seguro']);
  });

  it('ignora los papeles sin fecha en vez de darlos por vencidos', () => {
    expect(documentosPorVencer([{ tipo: 'cedula' }], HOY)).toHaveLength(0);
    expect(documentosPorVencer([{ tipo: 'x', vence: 'cuando sea' }], HOY)).toHaveLength(0);
  });

  /*
   * El día se pasa como texto y no se saca del reloj del servidor: la tienda
   * corre en UTC y la fecha que importa es la de Panamá. Es la misma trampa que
   * en el hash de sesión de Yappy.
   */
  it('compara contra el día que se le da, no contra el reloj', () => {
    const sinAviso = documentosPorVencer([{ tipo: 'licencia', vence: '2026-09-20' }], '2026-01-01');
    expect(sinAviso).toHaveLength(0);
  });
});
