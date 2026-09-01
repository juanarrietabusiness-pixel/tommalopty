import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  SHIPMENT_STATUS_LABELS,
  isShipmentStatus,
  navigationLinks,
  type ShipmentStatus,
} from '@nebula/domain';
import { getSupabaseServiceClient, isSupabaseConfigured } from '@/lib/supabase';
import { AccionesDeEntrega } from '@/components/acciones-de-entrega';

/**
 * La página que abre el QR de la guía.
 *
 * POR QUÉ EL QR NO LLEVA UNA COORDENADA DIRECTA
 *
 * Un QR con un `geo:` crudo abre lo que decida el sistema operativo, y en
 * muchos teléfonos no abre nada. Con esta página intermedia quien entrega
 * **elige** su aplicación —en Panamá la mayoría usa Waze, pero no todos— y de
 * paso la página sirve para lo que un enlace a un mapa no puede: enseñar la
 * referencia, llamar al cliente de un toque y marcar el resultado de la
 * entrega. El QR deja de ser una etiqueta y pasa a ser la herramienta.
 *
 * QUIÉN PUEDE ABRIRLA
 *
 * Cualquiera que tenga el token, y es a propósito: quien entrega no tiene
 * cuenta en el sistema, y pedirle que inicie sesión con el casco puesto es
 * pedirle que llame por teléfono en su lugar. El token es la llave, viaja
 * impreso en un papel que ya lleva encima, y no se puede adivinar: son 24
 * bytes aleatorios.
 *
 * Por eso la página se sirve desde el servidor con la clave de servicio y solo
 * devuelve los campos de este envío. Nunca se expone la tabla al rol público.
 */

export const metadata: Metadata = {
  title: 'Entrega',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

interface DestinoGuardado {
  firstName?: string;
  lastName?: string;
  line1?: string;
  line2?: string;
  city?: string;
  province?: string;
  phone?: string;
  reference?: string;
  deliveryInstructions?: string;
}

export default async function PaginaDeEntrega({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  // Un token con formato raro no llega a tocar la base de datos.
  if (!/^[a-f0-9]{48}$/.test(token)) notFound();
  if (!isSupabaseConfigured()) notFound();

  const supabase = getSupabaseServiceClient();
  const { data: envio } = await supabase
    .from('shipments')
    .select(
      `id, tracking_number, status, destination, latitude, longitude,
       carrier, carrier_tracking_url, failure_reason, delivered_at,
       orders (order_number, phone, customer_note)`,
    )
    .eq('token', token)
    .maybeSingle();

  if (!envio) notFound();

  const pedido = Array.isArray(envio.orders) ? envio.orders[0] : envio.orders;
  const destino = (envio.destination ?? {}) as DestinoGuardado;
  const estado: ShipmentStatus = isShipmentStatus(envio.status) ? envio.status : 'pendiente';

  const enlaces =
    envio.latitude !== null && envio.longitude !== null
      ? navigationLinks({ lat: envio.latitude, lng: envio.longitude })
      : null;

  const telefono = destino.phone ?? pedido?.phone ?? null;
  const nombre = [destino.firstName, destino.lastName].filter(Boolean).join(' ');
  const cerrado = estado === 'entregado' || estado === 'devuelto';

  return (
    <main className="entrega">
      <header className="entrega-cabecera">
        <span className="entrega-guia">{envio.tracking_number}</span>
        <span className="entrega-estado" data-estado={estado}>
          {SHIPMENT_STATUS_LABELS[estado]}
        </span>
      </header>

      {/*
        Los dos botones de navegación van primero y grandes. Es lo que se toca
        con el teléfono en una mano, y muchas veces lo único que se toca.
      */}
      {enlaces ? (
        <div className="entrega-navegar">
          <a className="btn btn-dark entrega-boton" href={enlaces.waze} rel="noreferrer">
            Abrir en Waze
          </a>
          <a className="btn btn-outline entrega-boton" href={enlaces.googleMaps} rel="noreferrer">
            Abrir en Google Maps
          </a>
        </div>
      ) : (
        <div className="notice notice-error">
          Este envío no tiene punto en el mapa. Guíate por la dirección y la referencia de abajo, y
          llama si hace falta.
        </div>
      )}

      <section className="entrega-bloque">
        <h2>A dónde va</h2>
        <p className="entrega-direccion">
          {destino.line1}
          {destino.line2 ? `, ${destino.line2}` : ''}
          {destino.city ? (
            <>
              <br />
              {destino.city}
              {destino.province ? `, ${destino.province}` : ''}
            </>
          ) : null}
        </p>

        {destino.reference ? (
          <p className="entrega-referencia">
            <strong>Cómo reconocerlo:</strong> {destino.reference}
          </p>
        ) : null}

        {destino.deliveryInstructions ? (
          <p className="entrega-referencia">
            <strong>Al llegar:</strong> {destino.deliveryInstructions}
          </p>
        ) : null}

        {pedido?.customer_note ? (
          <p className="entrega-referencia">
            <strong>Nota del cliente:</strong> {pedido.customer_note}
          </p>
        ) : null}
      </section>

      <section className="entrega-bloque">
        <h2>Quién recibe</h2>
        <p className="entrega-direccion">{nombre || 'Sin nombre registrado'}</p>
        {telefono ? (
          <a className="btn btn-outline entrega-boton" href={`tel:${telefono.replace(/\s/g, '')}`}>
            Llamar a {telefono}
          </a>
        ) : (
          <p className="field-hint">Este pedido no dejó teléfono.</p>
        )}
      </section>

      {envio.carrier_tracking_url ? (
        <section className="entrega-bloque">
          <h2>Courier</h2>
          <p className="entrega-direccion">{envio.carrier}</p>
          <a
            className="btn btn-outline entrega-boton"
            href={envio.carrier_tracking_url}
            rel="noreferrer"
          >
            Ver rastreo del transportista
          </a>
        </section>
      ) : null}

      {cerrado ? (
        <div className="notice notice-success">
          Este envío ya está {SHIPMENT_STATUS_LABELS[estado].toLowerCase()}. No hay nada más que
          hacer aquí.
        </div>
      ) : (
        <AccionesDeEntrega token={token} estado={estado} />
      )}

      <p className="entrega-pie">
        Pedido {pedido?.order_number ?? '—'} · Guía {envio.tracking_number}
      </p>
    </main>
  );
}
