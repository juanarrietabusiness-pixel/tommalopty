import { describe, expect, it } from 'vitest';
import { listMisEnvios, listMiDia, tieneFichaDeMotorizado } from '../repositories/logistica';

/**
 * Que la consulta del motorizado pida lo suyo, y no lo de todos.
 *
 * POR QUÉ ESTE ARCHIVO NO HABLA CON POSTGRES
 *
 * `motorizados.test.ts` prueba lo que decide la base: qué filas devuelve RLS a
 * un motorizado. Eso ya está probado y sigue siendo correcto. Lo que no se veía
 * desde ahí es el caso que rompió: **las políticas permisivas se suman**, así
 * que quien es motorizado y además del equipo pasa por `shipments_staff_read` y
 * recibe la flota entera. La base hace lo que debe; era la consulta la que no
 * acotaba.
 *
 * Probar eso contra Postgres exigiría una cuenta que sea las dos cosas y un
 * juego de envíos ajenos. Es mucho montaje para afirmar algo mucho más simple:
 * que estas dos consultas llevan un filtro por `assigned_to`. Así que se afirma
 * con un cliente de mentira que anota lo que se le pide, y este archivo corre
 * sin Docker, que es justo donde se olvidaría el filtro al reescribir la
 * consulta.
 */

/** Anota los filtros que le aplican y devuelve la lista vacía. */
function clienteQueAnota() {
  const filtros: Array<[string, string, unknown]> = [];

  const encadenable = {
    select: () => encadenable,
    eq: (columna: string, valor: unknown) => {
      filtros.push(['eq', columna, valor]);
      return encadenable;
    },
    in: (columna: string, valor: unknown) => {
      filtros.push(['in', columna, valor]);
      return encadenable;
    },
    not: (columna: string, operador: string, valor: unknown) => {
      filtros.push(['not', columna, `${operador} ${String(valor)}`]);
      return encadenable;
    },
    gte: (columna: string, valor: unknown) => {
      filtros.push(['gte', columna, valor]);
      return encadenable;
    },
    order: () => Promise.resolve({ data: [], error: null }),
    maybeSingle: () => Promise.resolve({ data: null, error: null }),
  };

  return {
    filtros,
    cliente: { from: () => encadenable } as never,
  };
}

const MOTORIZADO = '00000000-0000-4000-9000-000000000001';

describe('lo que pide la pantalla del motorizado', () => {
  it('«mis entregas» se acota al identificador de quien consulta', async () => {
    const { cliente, filtros } = clienteQueAnota();

    await listMisEnvios(cliente, MOTORIZADO);

    expect(filtros).toContainEqual(['eq', 'assigned_to', MOTORIZADO]);
  });

  it('«mi día» también, o el resumen cuenta las entregas de la flota', async () => {
    const { cliente, filtros } = clienteQueAnota();

    await listMiDia(cliente, MOTORIZADO, '2026-09-06T05:00:00.000Z');

    expect(filtros).toContainEqual(['eq', 'assigned_to', MOTORIZADO]);
  });

  it('«mis entregas» sigue dejando fuera lo cerrado', async () => {
    const { cliente, filtros } = clienteQueAnota();

    await listMisEnvios(cliente, MOTORIZADO);

    // El filtro de estado es lo que mantiene la lista utilizable en la calle:
    // si desaparece, la pantalla crece para siempre y deja de servir.
    expect(filtros.some(([operador, columna]) => operador === 'not' && columna === 'status')).toBe(
      true,
    );
  });

  it('la ficha de motorizado se busca por la cuenta, no por la ficha', async () => {
    const { cliente, filtros } = clienteQueAnota();

    await tieneFichaDeMotorizado(cliente, MOTORIZADO);

    // `profile_id` y no `id`: la ficha tiene identificador propio, y buscar por
    // él con el de la cuenta no encuentra nunca nada —y «nunca nada» aquí se lee
    // como «no es motorizado», que es el mensaje equivocado.
    expect(filtros).toContainEqual(['eq', 'profile_id', MOTORIZADO]);
  });
});
