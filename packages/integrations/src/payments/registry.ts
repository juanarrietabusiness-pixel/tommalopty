import { pagueloFacilProvider } from './providers/paguelofacil';
import { paypalProvider } from './providers/paypal';
import { wompiProvider } from './providers/wompi';
import { yappyProvider } from './providers/yappy';
import type { PaymentProvider, PaymentProviderId } from './types';

/**
 * Registro de pasarelas.
 *
 * Qué pasarelas se ofrecen se decide con PAYMENTS_ENABLED_PROVIDERS (lista
 * separada por comas). Así se puede activar Yappy en producción sin tocar
 * código, y el checkout solo depende de esta función.
 *
 * Nota para el equipo: Stripe no opera con comercios domiciliados en Panamá
 * (su cobertura en Latinoamérica se limita a Brasil y México), por eso no
 * aparece aquí. Ver docs/PAGOS-PANAMA.md.
 */
const ALL_PROVIDERS: Record<PaymentProviderId, PaymentProvider | null> = {
  paypal: paypalProvider,
  wompi: wompiProvider,
  paguelofacil: pagueloFacilProvider,
  yappy: yappyProvider,
  manual: null,
};

const DEFAULT_ENABLED: PaymentProviderId[] = ['paypal', 'wompi'];

export function getEnabledProviderIds(): PaymentProviderId[] {
  const raw = process.env.PAYMENTS_ENABLED_PROVIDERS;
  if (!raw) return DEFAULT_ENABLED;

  return raw
    .split(',')
    .map((id) => id.trim().toLowerCase())
    .filter((id): id is PaymentProviderId => id in ALL_PROVIDERS && id !== 'manual');
}

export function getProvider(id: PaymentProviderId): PaymentProvider {
  const provider = ALL_PROVIDERS[id];
  if (!provider) {
    throw new Error(`Pasarela de pago desconocida o no disponible: "${id}".`);
  }
  return provider;
}

export interface AvailableProvider {
  id: PaymentProviderId;
  label: string;
  methods: readonly string[];
  /** false = falta cargar credenciales; el checkout lo muestra deshabilitado. */
  isConfigured: boolean;
}

/** Pasarelas a mostrar en el checkout, con su estado de configuración. */
export function listAvailableProviders(): AvailableProvider[] {
  return getEnabledProviderIds().map((id) => {
    const provider = getProvider(id);
    return {
      id: provider.id,
      label: provider.label,
      methods: provider.methods,
      isConfigured: provider.isConfigured(),
    };
  });
}
