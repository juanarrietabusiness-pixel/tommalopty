import { describe, expect, it } from 'vitest';
import { hashUserData, normalizeEmail, normalizeName, normalizePhone, sha256Hex } from './hash';

describe('normalización de datos para Meta', () => {
  it('normaliza el email a minúsculas sin espacios', () => {
    expect(normalizeEmail('  Ana.Perez@Correo.COM ')).toBe('ana.perez@correo.com');
  });

  it('lleva el teléfono a E.164 con prefijo de Panamá', () => {
    expect(normalizePhone('6123-4567')).toBe('50761234567');
    expect(normalizePhone('507 6123 4567')).toBe('50761234567');
  });

  it('quita acentos del nombre', () => {
    expect(normalizeName(' José ')).toBe('jose');
  });

  it('produce el SHA-256 que Meta espera', async () => {
    // Vector conocido: sha256("test@example.com")
    await expect(sha256Hex('test@example.com')).resolves.toBe(
      '973dfe463ec85785f5f95af5ba3906eedb2d931c24e69824a89ea65dba4e813b',
    );
  });

  it('nunca deja datos personales en claro', async () => {
    const userData = await hashUserData({ email: 'ana@correo.com', phone: '61234567' });
    expect(userData.em?.[0]).toMatch(/^[a-f0-9]{64}$/);
    expect(userData.ph?.[0]).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(userData)).not.toContain('ana@correo.com');
  });
});
