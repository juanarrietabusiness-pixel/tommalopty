import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { SHIPMENT_STATUS_LABELS, navigationLinks, type ShipmentStatus } from '@nebula/domain';
import { getSupabaseServerClient, isSupabaseConfigured } from '@/lib/supabase';
import { destinoDelEnvio, nombreDeQuienRecibe } from '@/lib/entregas';
import { CerrarEntrega } from '@/components/cerrar-entrega';

/**
 * El envío que se está haciendo ahora mismo.
 *
 * No comprueba de quién es: no hace falta. La política RLS solo devuelve los
 * envíos con `assigned_to = auth.uid()`, así que pedir el de otro devuelve
 * «no encontrado» sin que esta pantalla tenga que saber nada de permisos.
 * Comprobarlo aquí además sería repetir la regla en un sitio donde puede quedar
 * desactualizada.
 */

export const metadata: Metadata = {
  title: 'Entrega',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function DetalleDeEntregaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!isSupabaseConfigured()) notFound();

  const supabase = await getSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(`/entrar?siguiente=/motorizado/${id}`);

  const { data: envio } = await supabase
    .from('shipments')
    .select(
      `id, tracking_number, status, destination, latitude, longitude,
       delivery_note, received_by, failure_reason, delivery_proof_key`,
    )
    .eq('id', id)
    .maybeSingle();

  if (!envio) notFound();

  const destino = destinoDelEnvio(envio.destination);
  const estado = envio.status as ShipmentStatus;

  const enlaces =
    envio.latitude !== null && envio.longitude !== null
      ? navigationLinks({ lat: envio.latitude, lng: envio.longitude })
      : null;

  return (
    <div className="motorizado">
      <header className="motorizado-cabecera">
        <Link href="/motorizado" className="motorizado-volver">
          ← Mis entregas
        </Link>
        <h1>{envio.tracking_number}</h1>
        <span className={`motorizado-estado estado-${estado}`}>
          {SHIPMENT_STATUS_LABELS[estado]}
        </span>
      </header>

      <section className="motorizado-bloque">
        <h2>A dónde</h2>
        <p className="motorizado-direccion">
          {destino.line1 ?? 'Sin dirección escrita'}
          {destino.line2 ? (
            <>
              <br />
              {destino.line2}
            </>
          ) : null}
          {destino.city ? (
            <>
              <br />
              {destino.city}
              {destino.province ? `, ${destino.province}` : ''}
            </>
          ) : null}
        </p>

        {/*
          La referencia va destacada y no como un detalle más: en Panamá es lo
          que de verdad encuentra la puerta. La dirección escrita sitúa la
          manzana; «portón negro al lado de la farmacia» sitúa la casa.
        */}
        {destino.reference ? <p className="motorizado-referencia">{destino.reference}</p> : null}

        {destino.deliveryInstructions ? (
          <p className="motorizado-instrucciones">{destino.deliveryInstructions}</p>
        ) : null}
      </section>

      {/*
        Los dos, y no uno: en Panamá la mayoría de motorizados usa Waze, pero no
        todos. Un `geo:` crudo abre lo que decida el teléfono, y en muchos no
        abre nada.
      */}
      {enlaces ? (
        <div className="motorizado-navegar">
          <a className="btn btn-dark" href={enlaces.waze} target="_blank" rel="noreferrer">
            Waze
          </a>
          <a className="btn btn-outline" href={enlaces.googleMaps} target="_blank" rel="noreferrer">
            Google Maps
          </a>
        </div>
      ) : (
        <div className="notice notice-info">
          Este envío no trae punto en el mapa. Guíate por la dirección y la referencia, y llama si
          no la encuentras.
        </div>
      )}

      {destino.phone ? (
        <a className="btn btn-outline motorizado-llamar" href={`tel:${destino.phone}`}>
          Llamar a {nombreDeQuienRecibe(destino) || 'quien recibe'} · {destino.phone}
        </a>
      ) : null}

      {/*
        Se pasa si hay foto, no la foto. La clave del objeto no sale de aquí: el
        motorizado no necesita verla y una clave que llega al navegador acaba en
        una captura de pantalla.
      */}
      <CerrarEntrega
        shipmentId={envio.id}
        estado={estado}
        recibidoPor={envio.received_by ?? ''}
        nota={envio.delivery_note ?? ''}
        tieneFoto={Boolean(envio.delivery_proof_key)}
      />
    </div>
  );
}
