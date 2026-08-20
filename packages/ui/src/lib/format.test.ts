import { describe, expect, it } from 'vitest';
import { discountPercent, money, percent, slugify } from './format';

describe('formato de precio', () => {
  // El diseño aprobado muestra "$29.98". El símbolo por defecto de es-PA es
  // "USD 29.98", que rompe la fidelidad visual del esqueleto.
  it('usa el símbolo de dólar, no el código de moneda', () => {
    expect(money(29.98)).toBe('$29.98');
    expect(money(1234.5)).toContain('$');
    expect(money(29.98)).not.toContain('USD');
  });

  it('siempre muestra dos decimales', () => {
    expect(money(30)).toBe('$30.00');
    expect(money(0)).toBe('$0.00');
  });

  it('no explota con valores ausentes o inválidos', () => {
    expect(money(null)).toBe('$0.00');
    expect(money(undefined)).toBe('$0.00');
    expect(money(Number.NaN)).toBe('$0.00');
  });

  it('acepta el numeric que devuelve Postgres como texto', () => {
    expect(money('45.50')).toBe('$45.50');
  });
});

describe('porcentaje de descuento', () => {
  it('calcula el ahorro sobre el precio anterior', () => {
    expect(discountPercent(30, 40)).toBe(25);
  });

  it('devuelve cero si no hay precio anterior o no es mayor', () => {
    expect(discountPercent(30, null)).toBe(0);
    expect(discountPercent(30, 30)).toBe(0);
    expect(discountPercent(30, 20)).toBe(0);
  });

  it('redondea al entero más cercano', () => {
    expect(percent(24.6)).toBe('25%');
  });
});

describe('slug', () => {
  // Debe coincidir con `public.slugify` de Postgres: si divergen, el panel
  // propone un slug y la base guarda otro.
  it('normaliza acentos y espacios', () => {
    expect(slugify('Café Orgánico 250g')).toBe('cafe-organico-250g');
  });

  it('quita símbolos y guiones sobrantes', () => {
    expect(slugify('  ¡Oferta! 50% —  ')).toBe('oferta-50');
  });

  it('deja intacto lo que ya es un slug', () => {
    expect(slugify('producto-destacado-uno')).toBe('producto-destacado-uno');
  });
});
