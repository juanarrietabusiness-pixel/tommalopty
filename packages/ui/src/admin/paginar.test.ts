import { describe, expect, it } from 'vitest';
import { paginar, parsePagina } from './paginar';

describe('parsePagina', () => {
  it('acepta un número de página normal', () => {
    expect(parsePagina('3')).toBe(3);
  });

  it('cae en la 1 cuando el parámetro no significa nada', () => {
    // Llega de la querystring, así que puede ser cualquier cosa. Ninguno de
    // estos debe convertirse en un offset: `Number('abc')` es NaN, y un NaN
    // metido en `.range()` devuelve una tabla vacía sin explicar por qué.
    for (const basura of [undefined, '', 'abc', '0', '-3', '2.5', 'Infinity', '1e999']) {
      expect(parsePagina(basura), `«${basura}» debería caer en la página 1`).toBe(1);
    }
  });
});

describe('paginar', () => {
  it('reparte un total en páginas y dice qué rango se enseña', () => {
    const p = paginar(1240, 2, 50);

    expect(p.pagina).toBe(2);
    expect(p.offset).toBe(50);
    expect(p.totalPaginas).toBe(25);
    expect(p.desde).toBe(51);
    expect(p.hasta).toBe(100);
  });

  it('la última página no promete más filas de las que hay', () => {
    // 1240 = 24 páginas de 50 + 40. Si `hasta` fuese siempre offset+porPagina,
    // el pie diría «mostrando 1201-1250 de 1240», que además de falso es
    // imposible.
    const p = paginar(1240, 25, 50);

    expect(p.desde).toBe(1201);
    expect(p.hasta).toBe(1240);
  });

  it('sujeta una página que no existe a la última que sí', () => {
    // Un enlace viejo, o un filtro que redujo la lista. Sin esto la consulta
    // pediría un offset más allá del final y la pantalla enseñaría una tabla
    // vacía debajo de «1.240 pedidos», que es la contradicción a evitar.
    expect(paginar(1240, 900, 50).pagina).toBe(25);
  });

  it('una lista vacía sigue teniendo una página, y no enseña un rango falso', () => {
    const p = paginar(0, 1, 50);

    expect(p.totalPaginas).toBe(1);
    expect(p.desde).toBe(0);
    expect(p.hasta).toBe(0);
  });

  it('un total exactamente divisible no inventa una página de más', () => {
    // 100/50 son dos páginas, no tres. `ceil` lo hace bien y `floor + 1` no,
    // y es un fallo que solo se ve en los múltiplos exactos.
    expect(paginar(100, 1, 50).totalPaginas).toBe(2);
  });

  it('un tamaño de página absurdo no rompe las cuentas', () => {
    // Nadie debería llamar así, pero un 0 aquí sería una división por cero y
    // un `totalPaginas` de Infinity.
    const p = paginar(10, 1, 0);

    expect(Number.isFinite(p.totalPaginas)).toBe(true);
    expect(p.porPagina).toBeGreaterThanOrEqual(1);
  });
});
