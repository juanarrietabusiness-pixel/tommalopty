import { describe, expect, it } from 'vitest';
import { clasificar, esBarrible, type ObjetoAlmacenado } from './huerfanos';

const AHORA = new Date('2026-09-04T12:00:00Z');

function objeto(key: string, horasDeEdad: number, bytes = 1000): ObjetoAlmacenado {
  return { key, subidoEn: new Date(AHORA.getTime() - horasDeEdad * 3600_000), bytes };
}

const base = {
  ahora: AHORA,
  margenHoras: 24,
  enumeracionCompleta: true,
};

describe('esBarrible', () => {
  it('solo alcanza las carpetas de imágenes', () => {
    expect(esBarrible('productos/2026/09/a.jpg')).toBe(true);
    expect(esBarrible('cms/2026/09/a.jpg')).toBe(true);
    expect(esBarrible('backups/dump.sql')).toBe(false);
    // Un prefijo que solo empieza igual no cuenta.
    expect(esBarrible('productos-viejos/a.jpg')).toBe(false);
  });
});

describe('clasificar', () => {
  it('separa lo referenciado de lo que sobra', () => {
    const enUso = objeto('productos/2026/01/en-uso.jpg', 100);
    const sobra = objeto('productos/2026/01/sobra.jpg', 100, 4096);

    const r = clasificar({
      ...base,
      objetos: [enUso, sobra],
      clavesEnUso: new Set([enUso.key]),
    });

    expect(r.enUso.map((o) => o.key)).toEqual([enUso.key]);
    expect(r.huerfanos.map((o) => o.key)).toEqual([sobra.key]);
    expect(r.bytesHuerfanos).toBe(4096);
  });

  /**
   * LA TRAMPA 1, y la que borraría el bucket entero.
   *
   * Si la consulta a la base falla y devuelve cero claves, «lo que nadie
   * referencia» es todo. Sin esta guarda, un fallo de red se lleva el catálogo.
   */
  it('no declara nada huérfano si la enumeración no fue completa', () => {
    const r = clasificar({
      ...base,
      enumeracionCompleta: false,
      objetos: [objeto('productos/2026/01/a.jpg', 500), objeto('cms/2026/01/b.jpg', 500)],
      clavesEnUso: new Set(),
    });

    expect(r.huerfanos).toHaveLength(0);
    expect(r.bytesHuerfanos).toBe(0);
    expect(r.enUso).toHaveLength(2);
  });

  /**
   * LA TRAMPA 2: el panel sube la imagen y guarda el formulario después. Entre
   * las dos cosas no hay fila que la referencie, y es justo la que alguien está
   * a punto de usar.
   */
  it('protege lo recién subido, que aún no tiene fila', () => {
    const recien = objeto('productos/2026/09/recien.jpg', 2);
    const vieja = objeto('productos/2026/01/vieja.jpg', 500);

    const r = clasificar({ ...base, objetos: [recien, vieja], clavesEnUso: new Set() });

    expect(r.recientes.map((o) => o.key)).toEqual([recien.key]);
    expect(r.huerfanos.map((o) => o.key)).toEqual([vieja.key]);
  });

  it('protege ante un empate exacto con el corte', () => {
    const justo = objeto('productos/2026/09/justo.jpg', 24);
    const r = clasificar({ ...base, objetos: [justo], clavesEnUso: new Set() });
    expect(r.recientes).toHaveLength(1);
    expect(r.huerfanos).toHaveLength(0);
  });

  it('nunca deja el margen a cero, aunque se lo pidan', () => {
    const recien = objeto('productos/2026/09/recien.jpg', 0.5);

    for (const margenHoras of [0, -5, Number.NaN]) {
      const r = clasificar({ ...base, margenHoras, objetos: [recien], clavesEnUso: new Set() });
      expect(r.huerfanos).toHaveLength(0);
      expect(r.recientes).toHaveLength(1);
    }
  });

  it('no toca lo que está fuera de las carpetas de imágenes', () => {
    const ajeno = objeto('backups/dump.sql', 900, 999999);
    const r = clasificar({ ...base, objetos: [ajeno], clavesEnUso: new Set() });

    expect(r.ajenos.map((o) => o.key)).toEqual([ajeno.key]);
    expect(r.huerfanos).toHaveLength(0);
    expect(r.bytesHuerfanos).toBe(0);
  });
});
