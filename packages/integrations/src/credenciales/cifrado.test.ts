import { describe, expect, it } from 'vitest';
import {
  cifrar,
  descifrar,
  enmascarar,
  ErrorDeCifrado,
  generarClaveMaestra,
  importarClaveMaestra,
} from './cifrado';

// Deliberadamente sin la forma de ninguna credencial real: una cadena con pinta
// de clave de Stripe hizo que la protección de secretos de GitHub bloqueara el
// push, y tenía razón en bloquearlo.
const SECRETO = 'valor-de-prueba-largo-que-no-es-de-ningun-proveedor';

/** Parte un sobre en sus tres trozos, ya sin `undefined`, para poder alterarlos. */
function partir(sobre: string): { version: string; vector: string; cifrado: string } {
  const [version, vector, cifrado] = sobre.split('.');
  if (!version || !vector || !cifrado) throw new Error(`Sobre inesperado: ${sobre}`);
  return { version, vector, cifrado };
}

describe('la clave maestra', () => {
  it('la que genera vale para importar', async () => {
    await expect(importarClaveMaestra(generarClaveMaestra())).resolves.toBeDefined();
  });

  it('genera una distinta cada vez', () => {
    const claves = new Set(Array.from({ length: 50 }, () => generarClaveMaestra()));
    expect(claves.size).toBe(50);
  });

  // Lo que de verdad protege esto: una clave corta rellenada en silencio cifra
  // igual de bien a ojos del código y no protege nada.
  it('rechaza una clave más corta de 32 bytes en vez de rellenarla', async () => {
    const corta = btoa('demasiado corta');
    await expect(importarClaveMaestra(corta)).rejects.toThrow(ErrorDeCifrado);
    await expect(importarClaveMaestra(corta)).rejects.toThrow(/32 bytes/);
  });

  it('rechaza una clave más larga de 32 bytes', async () => {
    const larga = btoa('x'.repeat(64));
    await expect(importarClaveMaestra(larga)).rejects.toThrow(/32 bytes/);
  });

  it('rechaza algo que no es base64', async () => {
    await expect(importarClaveMaestra('esto no es base64 !!!')).rejects.toThrow(ErrorDeCifrado);
  });

  it('tolera espacios alrededor, que es como se pega desde un correo', async () => {
    const clave = generarClaveMaestra();
    await expect(importarClaveMaestra(`  ${clave}\n`)).resolves.toBeDefined();
  });
});

describe('cifrar y descifrar', () => {
  it('lo que cifra, descifra', async () => {
    const clave = await importarClaveMaestra(generarClaveMaestra());
    expect(await descifrar(await cifrar(SECRETO, clave), clave)).toBe(SECRETO);
  });

  it('aguanta acentos, emoji y cadenas largas', async () => {
    const clave = await importarClaveMaestra(generarClaveMaestra());
    const raros = ['contraseña con ñ y tildes áéí', '🔑🔒', 'x'.repeat(10_000), ''];

    for (const valor of raros) {
      expect(await descifrar(await cifrar(valor, clave), clave)).toBe(valor);
    }
  });

  // Si el vector fuese fijo, dos claves iguales darían el mismo sobre y se vería
  // en la base que dos integraciones comparten credencial.
  it('el mismo secreto cifrado dos veces da sobres distintos', async () => {
    const clave = await importarClaveMaestra(generarClaveMaestra());
    expect(await cifrar(SECRETO, clave)).not.toBe(await cifrar(SECRETO, clave));
  });

  it('el sobre lleva su versión delante', async () => {
    const clave = await importarClaveMaestra(generarClaveMaestra());
    expect(await cifrar(SECRETO, clave)).toMatch(/^v1\./);
  });

  it('el sobre no contiene el secreto en claro', async () => {
    const clave = await importarClaveMaestra(generarClaveMaestra());
    expect(await cifrar(SECRETO, clave)).not.toContain(SECRETO);
  });

  it('otra clave maestra no lo descifra', async () => {
    const suya = await importarClaveMaestra(generarClaveMaestra());
    const ajena = await importarClaveMaestra(generarClaveMaestra());

    await expect(descifrar(await cifrar(SECRETO, suya), ajena)).rejects.toThrow(ErrorDeCifrado);
  });

  // GCM autentica además de cifrar: esto es lo que impide que un byte cambiado
  // en la base se convierta en una credencial distinta y silenciosa.
  it('un sobre manipulado falla en vez de devolver basura', async () => {
    const clave = await importarClaveMaestra(generarClaveMaestra());
    const sobre = await cifrar(SECRETO, clave);

    const { version, vector, cifrado } = partir(sobre);
    const alterado = cifrado.startsWith('A') ? `B${cifrado.slice(1)}` : `A${cifrado.slice(1)}`;

    await expect(descifrar([version, vector, alterado].join('.'), clave)).rejects.toThrow(
      ErrorDeCifrado,
    );
  });

  it('un sobre con el vector cambiado falla', async () => {
    const clave = await importarClaveMaestra(generarClaveMaestra());
    const { version, cifrado } = partir(await cifrar(SECRETO, clave));
    const { vector: otroVector } = partir(await cifrar(SECRETO, clave));

    await expect(descifrar([version, otroVector, cifrado].join('.'), clave)).rejects.toThrow(
      ErrorDeCifrado,
    );
  });

  it('rechaza un sobre con forma distinta', async () => {
    const clave = await importarClaveMaestra(generarClaveMaestra());

    for (const malo of ['', 'abc', 'v1.solodospartes', 'v1.a.b.c', 'v1..abc', 'v1.abc.']) {
      await expect(descifrar(malo, clave)).rejects.toThrow(ErrorDeCifrado);
    }
  });

  it('rechaza una versión que no conoce, en vez de intentarlo igual', async () => {
    const clave = await importarClaveMaestra(generarClaveMaestra());
    const { vector, cifrado } = partir(await cifrar(SECRETO, clave));

    await expect(descifrar(['v2', vector, cifrado].join('.'), clave)).rejects.toThrow(/v2/);
  });

  it('el motivo del fallo no distingue clave equivocada de sobre dañado', async () => {
    const suya = await importarClaveMaestra(generarClaveMaestra());
    const ajena = await importarClaveMaestra(generarClaveMaestra());
    const sobre = await cifrar(SECRETO, suya);

    const { version, vector, cifrado } = partir(sobre);
    const alterado = cifrado.startsWith('A') ? `B${cifrado.slice(1)}` : `A${cifrado.slice(1)}`;

    const porClave = await descifrar(sobre, ajena).catch((e: Error) => e.message);
    const porDanio = await descifrar([version, vector, alterado].join('.'), suya).catch(
      (e: Error) => e.message,
    );

    expect(porClave).toBe(porDanio);
  });
});

describe('enmascarar', () => {
  it('deja ver los cuatro últimos de un secreto largo', () => {
    expect(enmascarar('clave-larga-de-prueba-abcd')).toBe('••••••••abcd');
  });

  it('no deja ver nada de uno corto', () => {
    // Enseñar los cuatro últimos de algo que mide seis es enseñarlo casi entero.
    expect(enmascarar('abc123')).toBe('••••••••');
    expect(enmascarar('')).toBe('••••••••');
  });

  it('nunca devuelve el secreto entero', () => {
    for (const secreto of ['clave-larga-de-prueba-abcd', 'abc123', 'x'.repeat(200)]) {
      expect(enmascarar(secreto)).not.toBe(secreto);
      expect(enmascarar(secreto).length).toBeLessThanOrEqual(12);
    }
  });
});
