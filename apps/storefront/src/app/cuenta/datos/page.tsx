import type { Metadata } from 'next';
import { getMyCustomer } from '@nebula/db';
import { getSupabaseServerClient, isSupabaseConfigured } from '@/lib/supabase';
import { AccountProfileForm, type ProfileValues } from '@/components/account-profile-form';
import { DEMO_CLIENTE } from '@/lib/demo-data';

export const metadata: Metadata = {
  title: 'Mis datos',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * Datos personales del cliente.
 *
 * Hasta ahora el panel de cliente enseñaba pedidos, direcciones y favoritos,
 * pero no dejaba corregir un nombre mal escrito ni añadir un teléfono. El
 * teléfono no es un adorno: es lo que resuelve una entrega cuando quien la
 * lleva no encuentra la dirección.
 */
export default async function AccountDataPage() {
  const initial = await cargarDatos();

  return (
    <>
      <h1 className="page-title">Mis datos</h1>
      <p className="page-subtitle">Cómo te llamamos y cómo te contactamos.</p>

      {!isSupabaseConfigured() ? (
        <div className="notice notice-info" style={{ marginBottom: 20 }}>
          Estos son datos de ejemplo. Con la tienda conectada, aquí editas los tuyos.
        </div>
      ) : null}

      <AccountProfileForm initial={initial} />
    </>
  );
}

async function cargarDatos(): Promise<ProfileValues> {
  if (!isSupabaseConfigured()) {
    return {
      firstName: DEMO_CLIENTE.nombre,
      lastName: DEMO_CLIENTE.apellido,
      phone: DEMO_CLIENTE.telefono,
      email: DEMO_CLIENTE.correo,
      acceptsMarketing: DEMO_CLIENTE.aceptaMarketing,
    };
  }

  const supabase = await getSupabaseServerClient();
  const customer = await getMyCustomer(supabase);

  return {
    firstName: customer?.first_name ?? '',
    lastName: customer?.last_name ?? '',
    phone: customer?.phone ?? '',
    email: customer?.email ?? '',
    acceptsMarketing: customer?.accepts_marketing ?? false,
  };
}
