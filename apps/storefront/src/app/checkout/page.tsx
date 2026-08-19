import type { Metadata } from 'next';
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

export default async function CheckoutPage() {
  const shippingMethods = await loadShippingMethods();

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
      <CheckoutForm shippingMethods={shippingMethods} paymentOptions={paymentOptions} />
    </div>
  );
}
