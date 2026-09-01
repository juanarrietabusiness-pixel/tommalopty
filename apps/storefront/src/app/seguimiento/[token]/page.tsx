import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SHIPMENT_STATUS_LABELS, isShipmentStatus, type ShipmentStatus } from '@nebula/domain';
import { dateTime, money } from '@nebula/ui';
import { getSupabaseServiceClient, isSupabaseConfigured } from '@/lib/supabase';

/**
 * Seguimiento del pedido para quien compró.
 *
 * EL TOKEN ES EL DEL PEDIDO, NO UNO NUEVO
 *
 * Se usa el mismo `confirmation_token` que ya viaja en el correo de
 * confirmación. Inventar un segundo token para lo mismo obligaría a mandar dos
 * enlaces distintos por pedido, y a explicarle al cliente cuál es cuál.
 *
 * QUÉ SE ENSEÑA Y QUÉ NO
 *
 * Se enseña el recorrido —qué pasó y cuándo— y no la bitácora entera. La
 * bitácora incluye notas internas, quién tocó qué y errores de pasarela: eso es
 * del equipo. Aquí solo van los estados, que es lo que responde a la pregunta
 * que trae quien entra: «¿dónde está mi pedido?».
 */

export const metadata: Metadata = {
  title: 'Seguimiento de tu pedido',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

const ETAPAS: { estado: ShipmentStatus; texto: string }[] = [
  { estado: 'pendiente', texto: 'Preparando tu pedido' },
  { estado: 'asignado', texto: 'Asignado a quien lo llevará' },
  { estado: 'recogido', texto: 'Recogido del almacén' },
  { estado: 'en_ruta', texto: 'En camino a tu dirección' },
  { estado: 'entregado', texto: 'Entregado' },
];

export default async function SeguimientoPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  if (!/^[a-f0-9]{48}$/.test(token)) notFound();
  if (!isSupabaseConfigured()) notFound();

  const supabase = getSupabaseServiceClient();

  const { data: pedido } = await supabase
    .from('orders')
    .select(
      `id, order_number, status, payment_status, total, created_at,
       shipments (id, tracking_number, status, carrier, carrier_tracking_url,
                  dispatched_at, delivered_at, failure_reason, created_at,
                  profiles:assigned_to (full_name, phone))`,
    )
    .eq('confirmation_token', token)
    .maybeSingle();

  if (!pedido) notFound();

  const envios = pedido.shipments ?? [];

  return (
    <div className="container section seguimiento">
      <h1 className="page-title">Tu pedido {pedido.order_number}</h1>
      <p className="page-subtitle">Hecho el {dateTime(pedido.created_at)}</p>

      {envios.length === 0 ? (
        <div className="notice notice-info">
          Tu pedido está confirmado y lo estamos preparando. En cuanto salga a reparto verás aquí
          por dónde va.
        </div>
      ) : (
        envios.map((envio) => {
          const estado: ShipmentStatus = isShipmentStatus(envio.status)
            ? envio.status
            : 'pendiente';

          const quienLleva = Array.isArray(envio.profiles) ? envio.profiles[0] : envio.profiles;
          const alcanzado = ETAPAS.findIndex((etapa) => etapa.estado === estado);

          return (
            <article className="seguimiento-envio" key={envio.id}>
              <header>
                <strong>{envio.tracking_number}</strong>
                <span className="tag tag-dark">{SHIPMENT_STATUS_LABELS[estado]}</span>
              </header>

              {estado === 'fallido' ? (
                <div className="notice notice-error">
                  No pudimos entregarlo en este intento
                  {envio.failure_reason ? `: ${envio.failure_reason}` : ''}. Vamos a reintentarlo y
                  te contactamos.
                </div>
              ) : estado === 'devuelto' ? (
                <div className="notice notice-error">
                  Este envío volvió a nuestro almacén. Escríbenos y lo resolvemos.
                </div>
              ) : (
                <ol className="seguimiento-linea">
                  {ETAPAS.map((etapa, indice) => (
                    <li
                      key={etapa.estado}
                      data-hecho={indice <= alcanzado}
                      data-actual={indice === alcanzado}
                    >
                      <span>{etapa.texto}</span>
                      {etapa.estado === 'en_ruta' && envio.dispatched_at ? (
                        <time>{dateTime(envio.dispatched_at)}</time>
                      ) : null}
                      {etapa.estado === 'entregado' && envio.delivered_at ? (
                        <time>{dateTime(envio.delivered_at)}</time>
                      ) : null}
                    </li>
                  ))}
                </ol>
              )}

              {quienLleva?.full_name ? (
                <p className="seguimiento-quien">
                  Lo lleva <strong>{quienLleva.full_name}</strong>
                  {quienLleva.phone ? ` · ${quienLleva.phone}` : ''}
                </p>
              ) : null}

              {envio.carrier_tracking_url ? (
                <a
                  className="btn btn-outline btn-sm"
                  href={envio.carrier_tracking_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Ver rastreo de {envio.carrier ?? 'el transportista'}
                </a>
              ) : null}
            </article>
          );
        })
      )}

      {pedido.payment_status !== 'paid' ? (
        <div className="notice notice-info" style={{ marginTop: 20 }}>
          Queda por pagar <strong>{money(Number(pedido.total))}</strong> al recibir.
        </div>
      ) : null}
    </div>
  );
}
