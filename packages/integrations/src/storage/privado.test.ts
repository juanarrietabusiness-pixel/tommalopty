import { describe, expect, it } from 'vitest';
import { cabecerasDeObjetoPrivado, comprobarSubidaPrivada, construirClavePrivada } from './privado';

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);

describe('construirClavePrivada', () => {
  it('agrupa por tipo, año, mes y dueño', () => {
    const clave = construirClavePrivada({
      tipo: 'entrega',
      duenoId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      extension: 'jpg',
      id: '11111111-2222-4333-8444-555555555555',
      now: new Date('2026-09-01T12:00:00Z'),
    });

    expect(clave).toBe(
      'entregas/2026/09/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee/11111111-2222-4333-8444-555555555555.jpg',
    );
  });

  /*
   * El identificador del dueño hoy viene de la base y es un UUID. Se limpia
   * igualmente: el día que llegue de otro sitio, una clave con barras dentro
   * escribiría fuera de su carpeta, y ese día nadie se va a acordar de mirar
   * aquí.
   */
  it('no deja que el dueño escriba fuera de su carpeta', () => {
    const clave = construirClavePrivada({
      tipo: 'abono',
      duenoId: '../../otro/sitio',
      extension: 'png',
      id: 'x',
      now: new Date('2026-09-01T12:00:00Z'),
    });

    expect(clave).not.toContain('..');
    expect(clave).toBe('abonos/2026/09/otrositio/x.png');
  });

  it('separa los dos tipos de contenido', () => {
    const base = {
      duenoId: 'abc',
      extension: 'jpg',
      id: '1',
      now: new Date('2026-09-01T00:00:00Z'),
    };
    expect(construirClavePrivada({ ...base, tipo: 'entrega' })).toMatch(/^entregas\//);
    expect(construirClavePrivada({ ...base, tipo: 'abono' })).toMatch(/^abonos\//);
  });
});

describe('comprobarSubidaPrivada', () => {
  it('acepta una imagen de verdad', () => {
    const resultado = comprobarSubidaPrivada({
      declaredType: 'image/jpeg',
      size: JPEG.length,
      bytes: JPEG,
    });

    expect(resultado).toMatchObject({ ok: true, type: 'image/jpeg', extension: 'jpg' });
  });

  /*
   * Que el fichero no vaya a servirse en una URL pública no lo hace inofensivo:
   * lo va a abrir alguien del equipo en su navegador. Un SVG es XML y admite
   * `<script>`.
   */
  it('rechaza un SVG aunque el bucket sea privado', () => {
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>');
    const resultado = comprobarSubidaPrivada({
      declaredType: 'image/svg+xml',
      size: svg.length,
      bytes: svg,
    });

    expect(resultado.ok).toBe(false);
  });

  it('rechaza lo que dice ser imagen y no lo es', () => {
    const falso = new TextEncoder().encode('MZ\x90\x00 esto es un ejecutable');
    const resultado = comprobarSubidaPrivada({
      declaredType: 'image/png',
      size: falso.length,
      bytes: falso,
    });

    expect(resultado.ok).toBe(false);
  });
});

describe('cabecerasDeObjetoPrivado', () => {
  const cabeceras = cabecerasDeObjetoPrivado({
    contentType: 'image/jpeg',
    nombreVisible: 'entrega-GU-000123.jpg',
  });

  /*
   * Entre el Worker y quien mira hay proxies, antivirus corporativos y el caché
   * del navegador. Una foto de la puerta de un cliente no se queda en ninguno.
   */
  it('prohíbe que nadie por el camino se quede una copia', () => {
    expect(cabeceras['Cache-Control']).toContain('private');
    expect(cabeceras['Cache-Control']).toContain('no-store');
  });

  it('impide que el navegador adivine otro tipo', () => {
    expect(cabeceras['X-Content-Type-Options']).toBe('nosniff');
  });

  it('no se puede incrustar desde otro sitio', () => {
    expect(cabeceras['X-Frame-Options']).toBe('DENY');
  });

  /*
   * El nombre viaja en una cabecera: unas comillas o un salto de línea dentro
   * partirían la respuesta HTTP en dos.
   */
  it('limpia el nombre antes de meterlo en la cabecera', () => {
    const sucio = cabecerasDeObjetoPrivado({
      contentType: 'image/png',
      nombreVisible: 'foto"; evil="1\r\nX-Otra: si.png',
    });

    expect(sucio['Content-Disposition']).toBe('inline; filename="fotoevil1X-Otrasi.png"');
  });
});
