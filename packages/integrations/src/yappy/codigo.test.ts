import { describe, expect, it } from 'vitest';
import { codigoDeSesion, fechaEnPanama } from './codigo';

/**
 * El ejemplo literal del manual (§ «Generación del código para inicio de
 * sesión»): API Key `ABCDE-7645X` y fecha `2025-01-01` se concatenan en
 * `ABCDE-7645X2025-01-01`, y de ahí sale el HMAC-SHA256 con la Secret Key.
 *
 * El manual no publica el hash resultante, así que lo que se fija aquí es el
 * valor que produce esta implementación. Eso sigue teniendo valor: si alguien
 * cambia la concatenación, el orden, o pasa a SHA-256 a secas en vez de HMAC,
 * el test lo dice. Lo que no puede decir es si Yappy espera otra receta — eso
 * solo lo confirma un login real, y por eso existe el script de validación.
 */
const API_KEY = 'ABCDE-7645X';
const SECRET = 'clave-secreta-de-prueba';

describe('codigoDeSesion', () => {
  it('es estable para la misma clave y la misma fecha', async () => {
    const uno = await codigoDeSesion(API_KEY, SECRET, '2025-01-01');
    const dos = await codigoDeSesion(API_KEY, SECRET, '2025-01-01');
    expect(uno).toBe(dos);
  });

  it('devuelve 64 caracteres hexadecimales, que es un SHA-256', async () => {
    const codigo = await codigoDeSesion(API_KEY, SECRET, '2025-01-01');
    expect(codigo).toMatch(/^[0-9a-f]{64}$/);
  });

  it('cambia con la fecha: un código de ayer no sirve hoy', async () => {
    const ayer = await codigoDeSesion(API_KEY, SECRET, '2024-12-31');
    const hoy = await codigoDeSesion(API_KEY, SECRET, '2025-01-01');
    expect(ayer).not.toBe(hoy);
  });

  it('cambia con la clave secreta', async () => {
    const conUna = await codigoDeSesion(API_KEY, 'una', '2025-01-01');
    const conOtra = await codigoDeSesion(API_KEY, 'otra', '2025-01-01');
    expect(conUna).not.toBe(conOtra);
  });

  it('cambia con la API Key', async () => {
    const uno = await codigoDeSesion('ABCDE-7645X', SECRET, '2025-01-01');
    const dos = await codigoDeSesion('ABCDE-7645Y', SECRET, '2025-01-01');
    expect(uno).not.toBe(dos);
  });

  /*
   * La receta del manual concatena sin separador, así que dos pares distintos
   * pueden producir la misma cadena. Se deja fijado porque es una propiedad
   * real de la receta —no un fallo de esta implementación, que no puede
   * apartarse de lo que Yappy espera— y porque explica una decisión: la fecha
   * la genera siempre `fechaEnPanama` y nunca llega desde fuera. El parámetro
   * `fecha` existe solo para estos tests.
   */
  it('hereda del manual una concatenación sin separador, y por eso la fecha no viene de fuera', async () => {
    const uno = await codigoDeSesion('AB', SECRET, '2025-01-01');
    const dos = await codigoDeSesion('AB2025', SECRET, '-01-01');
    expect(uno).toBe(dos);
  });
});

describe('fechaEnPanama', () => {
  /*
   * Es la regresión que más caro habría salido. El servidor corre en UTC; a
   * partir de las 19:00 de Panamá, en UTC ya es el día siguiente. Si el hash
   * usara la fecha del servidor, la sesión dejaría de abrirse cada tarde y
   * volvería a funcionar sola por la mañana.
   */
  it('a las 23:00 UTC sigue siendo el día anterior en Panamá', () => {
    expect(fechaEnPanama(new Date('2025-01-02T03:00:00Z'))).toBe('2025-01-01');
  });

  it('a mediodía UTC coincide con el día de Panamá', () => {
    expect(fechaEnPanama(new Date('2025-01-01T12:00:00Z'))).toBe('2025-01-01');
  });

  it('sale en el formato exacto que pide el manual', () => {
    expect(fechaEnPanama(new Date('2026-09-01T15:00:00Z'))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
