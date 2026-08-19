import type { Metadata } from 'next';
import { listMyAddresses } from '@nebula/db';
import { getSupabaseServerClient } from '@/lib/supabase';

export const metadata: Metadata = {
  title: 'Mis direcciones',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AddressesPage() {
  const supabase = await getSupabaseServerClient();
  const addresses = await listMyAddresses(supabase);

  return (
    <>
      <h1 className="page-title">Mis direcciones</h1>
      <p className="page-subtitle">Direcciones guardadas para agilizar tus compras.</p>

      {addresses.length === 0 ? (
        <p className="field-hint">
          Aún no has guardado ninguna dirección. La que uses en tu próximo pedido aparecerá aquí.
        </p>
      ) : (
        addresses.map((address) => (
          <article className="order-card" key={address.id}>
            <div className="order-card-head">
              <strong>
                {address.first_name} {address.last_name}
              </strong>
              {address.is_default ? <span className="tag tag-dark">Predeterminada</span> : null}
            </div>
            <p style={{ margin: 0, fontSize: '0.85rem', lineHeight: 1.6 }}>
              {address.line1}
              {address.line2 ? `, ${address.line2}` : ''}
              <br />
              {address.city}
              {address.province ? `, ${address.province}` : ''} · {address.country_code}
              {address.phone ? (
                <>
                  <br />
                  {address.phone}
                </>
              ) : null}
            </p>
          </article>
        ))
      )}
    </>
  );
}
