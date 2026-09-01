import type { Metadata } from 'next';
import { listDeliveryZones } from '@nebula/db';
import type { DeliveryZone } from '@nebula/domain';
import { payments } from '@nebula/integrations';
import { CheckoutForm, type ShippingMethodOption } from '@/components/checkout-form';
import { getSupabaseServerClient, isSupabaseConfigured } from '@/lib/supabase';

export const metadata: Metadata = {
  title: 'Checkout',
  robots: { index: false, follow: false },
};

// El checkout depende del carrito del visitante: nunca se cachea.
export const dynamic = 'force-dynamic';

async function loadShippingMethods(): Promise<ShippingMethodOption[]> {
  if (!isSupabaseConfigured()) {
    return [
      {
        id: '00000000-0000-0000-0000-000000000001',
        name: 'Envío estándar',
        description: 'Entrega a domicilio en Panamá',
        price: 5,
        freeAboveSubtotal: 50,
      },
    ];
  }

  const client = await getSupabaseServerClient();
  const { data } = await client
    .from('shipping_methods')
    .select('id, name, description, price, free_above_subtotal')
    .eq('is_active', true)
    .order('position');

  return (data ?? []).map((method) => ({
    id: method.id,
    name: method.name,
    description: method.description,
    price: method.price,
    freeAboveSubtotal: method.free_above_subtotal,
  }));
}

/**
 * Zonas de cobertura, para poder decir «hasta ahí no llegamos» antes de cobrar
 * y no después.
 *
 * Si la consulta falla se devuelve una lista vacía en vez de propagar el error:
 * sin zonas el selector deja de opinar sobre la cobertura, pero se puede seguir
 * comprando. Que no se pueda dibujar un aviso no es motivo para tumbar una venta.
 */
async function loadDeliveryZones(): Promise<DeliveryZone[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const client = await getSupabaseServerClient();
    return await listDeliveryZones(client);
  } catch (error) {
    console.error('[checkout] No se pudieron leer las zonas de reparto:', error);
    return [];
  }
}

export default async function CheckoutPage() {
  const [shippingMethods, deliveryZones] = await Promise.all([
    loadShippingMethods(),
    loadDeliveryZones(),
  ]);

  // Qué pasarelas se ofrecen lo decide el registro, no esta página.
  const paymentOptions = payments.listAvailableProviders().map((provider) => ({
    id: provider.id,
    label: provider.label,
    methods: provider.methods,
    isConfigured: provider.isConfigured,
  }));

  return (
    <div className="container">
      <h1 className="page-title" style={{ marginTop: 32 }}>
        Finalizar compra
      </h1>
      <p className="page-subtitle">Revisa tus datos antes de confirmar el pedido.</p>
      <CheckoutForm
        shippingMethods={shippingMethods}
        paymentOptions={paymentOptions}
        deliveryZones={deliveryZones}
      />
    </div>
  );
}
