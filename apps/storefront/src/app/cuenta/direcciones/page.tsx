import type { Metadata } from 'next';
import { listMyAddresses } from '@nebula/db';
import { getSupabaseServerClient, isSupabaseConfigured } from '@/lib/supabase';
import { getDemoDirecciones } from '@/lib/demo-data';
import { LibretaDeDirecciones, type DireccionGuardada } from '@/components/libreta-de-direcciones';

export const metadata: Metadata = {
  title: 'Mis direcciones',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * Las direcciones del cliente.
 *
 * La pantalla existía desde el principio, pero solo leía. Decía «la que uses en
 * tu próximo pedido aparecerá aquí» y era mentira: el checkout guarda la
 * dirección como copia dentro del pedido (`orders.shipping_address`), no en
 * esta tabla. Comprar no llenaba nunca esta lista, y no había forma de llenarla
 * a mano.
 */
export default async function AddressesPage() {
  const { direcciones, soloLectura } = await cargarDirecciones();

  return (
    <>
      <h1 className="page-title">Mis direcciones</h1>
      <p className="page-subtitle">Direcciones guardadas para agilizar tus compras.</p>

      {soloLectura ? (
        <div className="notice notice-info" style={{ marginBottom: 20 }}>
          Estas son direcciones de ejemplo. Con la tienda conectada, aquí guardas las tuyas.
        </div>
      ) : null}

      <LibretaDeDirecciones direcciones={direcciones} />
    </>
  );
}

async function cargarDirecciones(): Promise<{
  direcciones: DireccionGuardada[];
  soloLectura: boolean;
}> {
  if (!isSupabaseConfigured()) {
    return {
      soloLectura: true,
      direcciones: getDemoDirecciones().map((demo, indice) => {
        const [firstName, ...resto] = demo.nombre.split(' ');
        return {
          id: `demo-${indice}`,
          label: null,
          firstName: firstName ?? demo.nombre,
          lastName: resto.join(' '),
          line1: demo.linea1,
          line2: demo.linea2,
          city: demo.ciudad,
          province: demo.provincia,
          countryCode: demo.pais,
          postalCode: null,
          phone: demo.telefono,
          isDefault: demo.predeterminada,
        };
      }),
    };
  }

  const supabase = await getSupabaseServerClient();
  const addresses = await listMyAddresses(supabase);

  return {
    soloLectura: false,
    direcciones: addresses.map((address) => ({
      id: address.id,
      label: address.label,
      firstName: address.first_name,
      lastName: address.last_name,
      line1: address.line1,
      line2: address.line2,
      city: address.city,
      province: address.province,
      countryCode: address.country_code,
      postalCode: address.postal_code,
      phone: address.phone,
      isDefault: address.is_default,
    })),
  };
}
