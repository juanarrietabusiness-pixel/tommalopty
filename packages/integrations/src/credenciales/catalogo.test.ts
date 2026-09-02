import { describe, expect, it } from 'vitest';
import {
  clavesConocidas,
  estadoDeIntegracion,
  GRUPOS,
  INTEGRACIONES,
  integracionPorProveedor,
  porGrupo,
  type Integracion,
} from './catalogo';

function integracion(campos: Integracion['campos']): Integracion {
  return {
    proveedor: 'prueba',
    nombre: 'Prueba',
    grupo: 'pagos',
    resumen: 'Para el test.',
    tieneEntornos: false,
    campos,
  };
}

describe('el catálogo', () => {
  it('no repite proveedores', () => {
    const proveedores = INTEGRACIONES.map((i) => i.proveedor);
    expect(new Set(proveedores).size).toBe(proveedores.length);
  });

  // Dos integraciones que compartan clave se pisarían al guardar: la segunda
  // sobrescribiría la credencial de la primera sin que nadie lo viera.
  it('no repite claves entre integraciones', () => {
    const todas = INTEGRACIONES.flatMap((i) => i.campos.map((c) => c.clave));
    expect(new Set(todas).size).toBe(todas.length);
  });

  it('cada integración declara al menos un campo requerido', () => {
    for (const i of INTEGRACIONES) {
      expect(
        i.campos.some((c) => c.requerido),
        i.proveedor,
      ).toBe(true);
    }
  });

  it('cada integración cae en un grupo que existe', () => {
    for (const i of INTEGRACIONES) {
      expect(Object.keys(GRUPOS)).toContain(i.grupo);
    }
  });

  // `NEXT_PUBLIC_*` acaba en el navegador de cualquiera. Declarar uno como
  // secreto sería teatro: lo estaríamos cifrando en la base y publicándolo en el
  // HTML de la misma página.
  it('ningún campo NEXT_PUBLIC_ está marcado como secreto', () => {
    for (const i of INTEGRACIONES) {
      for (const campo of i.campos) {
        if (campo.clave.startsWith('NEXT_PUBLIC_')) {
          expect(campo.secreto, `${i.proveedor}.${campo.clave}`).toBe(false);
          expect(campo.publico, `${i.proveedor}.${campo.clave}`).toBe(true);
        }
      }
    }
  });

  // Al revés también: marcar público algo que no viaja al navegador haría que la
  // pantalla lo enseñara en claro sin motivo.
  it('nada marcado como público es secreto', () => {
    for (const i of INTEGRACIONES) {
      for (const campo of i.campos.filter((c) => c.publico)) {
        expect(campo.secreto, `${i.proveedor}.${campo.clave}`).toBe(false);
      }
    }
  });

  it('encuentra por proveedor, y devuelve undefined si no existe', () => {
    expect(integracionPorProveedor('yappy')?.nombre).toContain('Yappy');
    expect(integracionPorProveedor('no_existe')).toBeUndefined();
  });

  it('clavesConocidas trae todas las claves de todos los campos', () => {
    const claves = clavesConocidas();
    expect(claves.has('YAPPY_SECRET_KEY')).toBe(true);
    expect(claves.has('NEXT_PUBLIC_META_PIXEL_ID')).toBe(true);
    expect(claves.has('SUPABASE_SERVICE_ROLE_KEY')).toBe(false);
  });
});

describe('estadoDeIntegracion', () => {
  it('está configurada cuando tiene todos los requeridos', () => {
    const i = integracion([
      { clave: 'A', etiqueta: 'A', secreto: true, requerido: true },
      { clave: 'B', etiqueta: 'B', secreto: false, requerido: true },
    ]);

    expect(estadoDeIntegracion(i, new Set(['A', 'B']))).toEqual({ configurada: true, faltan: [] });
  });

  it('dice cuáles faltan, no solo que faltan', () => {
    const i = integracion([
      { clave: 'A', etiqueta: 'A', secreto: true, requerido: true },
      { clave: 'B', etiqueta: 'B', secreto: false, requerido: true },
    ]);

    expect(estadoDeIntegracion(i, new Set(['A']))).toEqual({ configurada: false, faltan: ['B'] });
  });

  // Si un campo opcional contara, la tarjeta diría «incompleta» y mandaría a
  // alguien a buscar durante media hora un dato que no necesita.
  it('un campo opcional que falta no la deja incompleta', () => {
    const i = integracion([
      { clave: 'A', etiqueta: 'A', secreto: true, requerido: true },
      { clave: 'OPCIONAL', etiqueta: 'Opcional', secreto: true, requerido: false },
    ]);

    expect(estadoDeIntegracion(i, new Set(['A'])).configurada).toBe(true);
  });

  it('sin ninguna clave, faltan todas las requeridas', () => {
    const i = integracion([
      { clave: 'A', etiqueta: 'A', secreto: true, requerido: true },
      { clave: 'B', etiqueta: 'B', secreto: false, requerido: true },
      { clave: 'C', etiqueta: 'C', secreto: false, requerido: false },
    ]);

    expect(estadoDeIntegracion(i, new Set()).faltan).toEqual(['A', 'B']);
  });
});

describe('porGrupo', () => {
  it('no pierde ninguna integración por el camino', () => {
    const agrupadas = porGrupo().flatMap((s) => s.integraciones);
    expect(agrupadas).toHaveLength(INTEGRACIONES.length);
  });

  it('no deja ninguna integración en dos grupos', () => {
    const proveedores = porGrupo().flatMap((s) => s.integraciones.map((i) => i.proveedor));
    expect(new Set(proveedores).size).toBe(proveedores.length);
  });

  it('no devuelve grupos vacíos, que solo serían un título suelto', () => {
    for (const seccion of porGrupo()) {
      expect(seccion.integraciones.length).toBeGreaterThan(0);
    }
  });

  it('respeta el orden en que se declaran los grupos', () => {
    const orden = porGrupo().map((s) => s.grupo);
    const declarado = (Object.keys(GRUPOS) as (keyof typeof GRUPOS)[]).filter((g) =>
      INTEGRACIONES.some((i) => i.grupo === g),
    );

    expect(orden).toEqual(declarado);
  });
});
