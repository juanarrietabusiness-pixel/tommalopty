import { describe, expect, it } from 'vitest';
import {
  funcionesConPrivilegios,
  funcionesCreadas,
  revisar,
  sinComentariosNiLiterales,
} from '../validar-migraciones.mjs';

/**
 * Tests del validador.
 *
 * Una comprobación de CI sin tests propios es una comprobación en la que nadie
 * confía: al primer falso positivo se desactiva, y al primer falso negativo se
 * descubre que llevaba meses pasando por encima de lo que venía a impedir.
 * `google/adk-samples` tiene `tools/tests/` por esto mismo — ocho ficheros de
 * test para ocho validadores.
 *
 * Lo que más importa aquí son los falsos positivos. El validador corre sobre
 * todas las migraciones en cada PR: si se queja de algo correcto, lo que se
 * borra es el validador.
 */

const migracion = (nombre: string, sql: string) => ({ nombre, sql });

describe('sinComentariosNiLiterales', () => {
  // El caso que motiva la función: la cabecera de una migración explica el
  // problema CITANDO el revoke que faltaba. Sin limpiar, esa cita cuenta como
  // el revoke que no está, y el validador da por buena justo la migración que
  // documenta el fallo.
  it('un revoke citado en un comentario no cuenta', () => {
    const sql = `
      -- La migración 0013 quiso cerrarla así:
      --   revoke all on function public.metricas(integer) from anon;
      -- y no bastó.
      create or replace function public.metricas(p integer) returns integer language sql as $$ select 1 $$;
    `;
    expect(funcionesConPrivilegios(sinComentariosNiLiterales(sql)).size).toBe(0);
  });

  it('un revoke dentro de un literal de texto tampoco', () => {
    const sql = `comment on function public.f(integer) is 'revoke all on function public.f from anon';`;
    expect(funcionesConPrivilegios(sinComentariosNiLiterales(sql)).size).toBe(0);
  });

  /**
   * Un cuerpo `$$ … $$` puede contener cualquier cosa, incluido SQL que crea
   * otra función. Con comillas simples lo salva el filtro de literales; con
   * comillas de dólar anidadas, solo esto.
   *
   * Sin la limpieza del cuerpo, el validador vería nacer una `fantasma` que no
   * existe y pediría privilegios para ella: un falso positivo sobre una
   * migración correcta. Y un falso positivo es lo que hace que alguien borre
   * el validador.
   */
  it('el cuerpo de la función no se lee como si fuera SQL de nivel superior', () => {
    const sql = `
      create function public.f() returns integer language plpgsql as $cuerpo$
      begin
        execute $sql$
          create function public.fantasma() returns integer language sql as $x$ select 1 $x$
        $sql$;
        return 1;
      end;
      $cuerpo$;
    `;
    expect([...funcionesCreadas(sinComentariosNiLiterales(sql))]).toEqual(['f']);
  });
});

describe('funcionesCreadas', () => {
  it('reconoce create function y create or replace function', () => {
    const sql = `
      create function public.una(a integer) returns integer language sql as $$ select 1 $$;
      create or replace function public.otra() returns text language sql as $$ select 'x' $$;
    `;
    expect([...funcionesCreadas(sql)].sort()).toEqual(['otra', 'una']);
  });

  // No se llaman, se disparan: no tienen superficie por RPC.
  it('deja fuera las funciones de disparador', () => {
    const sql = `create function public.guardia() returns trigger language plpgsql as $$ begin return new; end; $$;`;
    expect(funcionesCreadas(sql).size).toBe(0);
  });

  it('una tabla de retorno multilínea sigue contando', () => {
    const sql = `
      create function public.informe(p integer)
      returns table (
        a numeric,
        b bigint
      )
      language sql as $$ select 1::numeric, 1::bigint $$;
    `;
    expect([...funcionesCreadas(sql)]).toEqual(['informe']);
  });
});

describe('funcionesConPrivilegios', () => {
  it('ve el grant y el revoke, con y sin el prefijo public', () => {
    const sql = `
      revoke all on function public.una(integer) from public;
      grant execute on function otra() to service_role;
    `;
    expect([...funcionesConPrivilegios(sql)].sort()).toEqual(['otra', 'una']);
  });

  /**
   * Un barrido en masa NO cuenta como cobertura, y este test existe porque la
   * primera versión del validador decía que sí.
   *
   * La migración 0021 lleva un `execute format('revoke all on function %s …')`
   * sobre una consulta al catálogo, y parecía razonable darlo por bueno.
   * Leyendo esa consulta resulta que filtra por `prorettype in ('trigger',
   * 'event_trigger')`: no toca ni una función llamable, que son las únicas que
   * este validador vigila. Darlo por bueno habría tapado exactamente lo que
   * viene a destapar.
   *
   * La regla general: un alcance que vive dentro de una consulta no se puede
   * leer desde fuera, así que no se supone.
   */
  it('un barrido en masa no cuenta como cobertura de nada', () => {
    const sql = `execute format('revoke all on function %s from public, anon, authenticated', fn.firma);`;
    expect(funcionesConPrivilegios(sql).size).toBe(0);
  });
});

describe('revisar', () => {
  it('señala la función creada sin declarar quién la ejecuta', () => {
    const fallos = revisar([
      migracion(
        '20260101000000_a.sql',
        `create function public.colada() returns integer language sql as $$ select 1 $$;`,
      ),
    ]);
    expect(fallos).toEqual([{ nombre: '20260101000000_a.sql', funciones: ['colada'] }]);
  });

  it('no señala la que sí los declara', () => {
    const fallos = revisar([
      migracion(
        '20260101000000_a.sql',
        `create function public.buena() returns integer language sql as $$ select 1 $$;
         revoke all on function public.buena() from public;`,
      ),
    ]);
    expect(fallos).toEqual([]);
  });

  /**
   * El caso que decidió el diseño.
   *
   * Una migración aplicada no se reescribe: cambiarla no cambia ninguna base de
   * datos, solo hace que el fichero mienta. Así que el descuido de ayer se
   * corrige con un fichero nuevo, y el validador tiene que darlo por bueno — o
   * la única salida sería falsear el historial.
   */
  it('vale que los privilegios lleguen en una migración posterior', () => {
    const fallos = revisar([
      migracion(
        '20260101000000_el_descuido.sql',
        `create function public.tardia() returns integer language sql as $$ select 1 $$;`,
      ),
      migracion(
        '20260102000000_el_arreglo.sql',
        `revoke all on function public.tardia() from public;`,
      ),
    ]);
    expect(fallos).toEqual([]);
  });

  // La otra mitad: al revés NO vale. Un revoke anterior no cubre a una función
  // que todavía no existía, porque `create function` la crea de nuevo con
  // EXECUTE para PUBLIC.
  it('un revoke ANTERIOR no cubre una función creada después', () => {
    const fallos = revisar([
      migracion('20260101000000_antes.sql', `revoke all on function public.futura() from public;`),
      migracion(
        '20260102000000_despues.sql',
        `create function public.futura() returns integer language sql as $$ select 1 $$;`,
      ),
    ]);
    expect(fallos).toEqual([{ nombre: '20260102000000_despues.sql', funciones: ['futura'] }]);
  });

  it('señala el fichero donde nació, no donde se detectó', () => {
    const fallos = revisar([
      migracion(
        '20260101000000_aqui_nacio.sql',
        `create function public.perdida() returns integer language sql as $$ select 1 $$;`,
      ),
      migracion('20260102000000_otra_cosa.sql', `select 1;`),
    ]);
    expect(fallos[0]!.nombre).toBe('20260101000000_aqui_nacio.sql');
  });

  it('una función heredada no se señala', () => {
    // `slugify` está en la lista con su motivo escrito.
    const fallos = revisar([
      migracion(
        '20260101000000_a.sql',
        `create function public.slugify(value text) returns text language sql as $$ select value $$;`,
      ),
    ]);
    expect(fallos).toEqual([]);
  });
});
