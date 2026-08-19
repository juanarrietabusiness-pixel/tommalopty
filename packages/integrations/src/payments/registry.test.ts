import { afterEach, describe, expect, it } from 'vitest';
import { getEnabledProviderIds, getProvider, listAvailableProviders } from './registry';
import { NotImplementedError } from './errors';

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('registro de pasarelas de pago', () => {
  it('usa PayPal y Wompi cuando no se configura la lista', () => {
    delete process.env.PAYMENTS_ENABLED_PROVIDERS;
    expect(getEnabledProviderIds()).toEqual(['paypal', 'wompi']);
  });

  it('respeta la lista de PAYMENTS_ENABLED_PROVIDERS', () => {
    process.env.PAYMENTS_ENABLED_PROVIDERS = 'yappy, paguelofacil';
    expect(getEnabledProviderIds()).toEqual(['yappy', 'paguelofacil']);
  });

  it('descarta identificadores desconocidos en lugar de romper el checkout', () => {
    process.env.PAYMENTS_ENABLED_PROVIDERS = 'paypal,stripe,manual';
    expect(getEnabledProviderIds()).toEqual(['paypal']);
  });

  it('marca como no configurada la pasarela sin credenciales', () => {
    process.env.PAYMENTS_ENABLED_PROVIDERS = 'paypal';
    delete process.env.PAYPAL_CLIENT_ID;
    delete process.env.PAYPAL_CLIENT_SECRET;

    const [paypal] = listAvailableProviders();
    expect(paypal?.isConfigured).toBe(false);
    expect(paypal?.label).toBe('PayPal');
  });

  it('detecta las credenciales cuando están presentes', () => {
    process.env.PAYMENTS_ENABLED_PROVIDERS = 'paypal';
    process.env.PAYPAL_CLIENT_ID = 'id-de-prueba';
    process.env.PAYPAL_CLIENT_SECRET = 'secreto-de-prueba';

    const [paypal] = listAvailableProviders();
    expect(paypal?.isConfigured).toBe(true);
  });

  it('falla de forma explícita al pedir una pasarela inexistente', () => {
    expect(() => getProvider('manual')).toThrow(/no disponible/);
  });

  it('los adaptadores anuncian claramente que faltan por implementar', () => {
    expect(() =>
      getProvider('wompi').createPayment({
        orderId: 'o1',
        orderNumber: 'NB-000001',
        amount: { value: 10, currency: 'USD' },
        customer: { email: 'demo@tudominio.com' },
        items: [],
        returnUrl: 'https://example.test/ok',
        cancelUrl: 'https://example.test/ko',
      }),
    ).toThrow(NotImplementedError);
  });
});
