import type { Metadata } from 'next';
import { listMyAddresses } from '@nebula/db';
import { getSupabaseServerClient, isSupabaseConfigured } from '@/lib/supabase';
import { getDemoDirecciones } from '@/lib/demo-data';

export const metadata: Metadata = {
  title: 'Mis direcciones',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AddressesPage() {
  if (!isSupabaseConfigured()) return <DireccionesDemo />;

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

function DireccionesDemo() {
  return (
    <>
      <h1 className="page-title">Mis direcciones</h1>
      <p className="page-subtitle">Direcciones guardadas para agilizar tus compras.</p>

      {getDemoDirecciones().map((direccion) => (
        <article className="order-card" key={direccion.linea1}>
          <div className="order-card-head">
            <strong>{direccion.nombre}</strong>
            {direccion.predeterminada ? <span className="tag tag-dark">Predeterminada</span> : null}
          </div>
          <p style={{ margin: 0, fontSize: '0.85rem', lineHeight: 1.6 }}>
            {direccion.linea1}
            {direccion.linea2 ? `, ${direccion.linea2}` : ''}
            <br />
            {direccion.ciudad}, {direccion.provincia} · {direccion.pais}
            <br />
            {direccion.telefono}
          </p>
        </article>
      ))}
    </>
  );
}
