import { notFound } from 'next/navigation';
import QRCode from 'qrcode';
import { dateTime, money } from '@nebula/ui';
import { requireStaff } from '@/lib/auth';
import { storefrontUrl } from '@/lib/site';
import { getSupabaseServerClient, isSupabaseConfigured } from '@/lib/supabase';

/**
 * La guía de despacho: lo que se imprime y viaja pegado al paquete.
 *
 * NO ES UN PDF, Y ES A PROPÓSITO
 *
 * El plan pedía un PDF de 4×6". Esto es HTML con `@page { size: 4in 6in }`, que
 * imprime exactamente esa etiqueta desde cualquier navegador y sale igual en la
 * térmica. Un PDF exigiría una librería de composición dentro del Worker —más
 * peso, más cosas que se rompen— para producir el mismo papel. Y de regalo: se
 * puede mirar en pantalla antes de gastar etiqueta, y quien no tenga térmica
 * lo imprime en una hoja normal.
 *
 * EL QR SE GENERA AQUÍ, NO EN UN SERVICIO
 *
 * Nada de una URL a un generador externo. Un QR que depende de que un tercero
 * responda es una etiqueta que un día sale en blanco, y encima le contaría a
 * ese tercero la dirección de cada cliente.
 */

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

export default async function GuiaDeDespacho({
  params,
}: {
  params: Promise<{ id: string; shipmentId: string }>;
}) {
  await requireStaff();
  const { id, shipmentId } = await params;

  if (!isSupabaseConfigured()) notFound();

  const supabase = await getSupabaseServerClient();

  const { data: envio } = await supabase
    .from('shipments')
    .select(
      `id, tracking_number, token, status, destination, carrier, carrier_tracking_number,
       created_at,
       orders (order_number, total, payment_status, customer_note,
               order_items (product_title, variant_title, quantity))`,
    )
    .eq('id', shipmentId)
    .eq('order_id', id)
    .maybeSingle();

  if (!envio) notFound();

  const pedido = Array.isArray(envio.orders) ? envio.orders[0] : envio.orders;
  const destino = (envio.destination ?? {}) as DestinoGuardado;
  const items = pedido?.order_items ?? [];

  const enlace = `${storefrontUrl()}/g/${envio.token}`;

  // `margin: 0` porque la etiqueta ya tiene su propio margen: el del QR encima
  // sobra y roba milímetros que en 4×6" se notan.
  const qr = await QRCode.toString(enlace, {
    type: 'svg',
    margin: 0,
    errorCorrectionLevel: 'M',
  });

  // Lo que se cobra al entregar. Cuando existan los abonos (fase L3) este
  // número será el saldo; hoy es el total si el pedido no está pagado.
  const porCobrar = pedido && pedido.payment_status !== 'paid' ? Number(pedido.total) : 0;

  return (
    <div className="guia-hoja">
      <div className="guia-barra-superior">
        <div>
          <strong>{envio.tracking_number}</strong>
          <span>Pedido {pedido?.order_number}</span>
        </div>
        <div className="guia-qr" dangerouslySetInnerHTML={{ __html: qr }} />
      </div>

      <div className="guia-destino">
        <h2>Entregar a</h2>
        <p className="guia-nombre">
          {[destino.firstName, destino.lastName].filter(Boolean).join(' ') || 'Sin nombre'}
        </p>
        <p className="guia-direccion">
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
        {destino.phone ? <p className="guia-telefono">{destino.phone}</p> : null}
      </div>

      {/* La referencia va en recuadro y grande: es lo que de verdad encuentra
          la puerta cuando la dirección escrita no basta. */}
      {destino.reference ? (
        <div className="guia-referencia">
          <span>Cómo reconocerlo</span>
          {destino.reference}
        </div>
      ) : null}

      {destino.deliveryInstructions ? (
        <div className="guia-referencia">
          <span>Al llegar</span>
          {destino.deliveryInstructions}
        </div>
      ) : null}

      {porCobrar > 0 ? (
        <div className="guia-cobrar">
          Cobrar al entregar <strong>{money(porCobrar)}</strong>
        </div>
      ) : (
        <div className="guia-pagado">Pedido pagado · no cobrar</div>
      )}

      <div className="guia-items">
        <h2>Contenido</h2>
        <ul>
          {items.map((item: (typeof items)[number], indice: number) => (
            <li key={`${item.product_title}-${indice}`}>
              <span>{item.quantity}×</span> {item.product_title}
              {item.variant_title && item.variant_title !== 'Estándar'
                ? ` · ${item.variant_title}`
                : ''}
            </li>
          ))}
        </ul>
      </div>

      <p className="guia-pie">
        Escanea el código para navegar y marcar la entrega · {dateTime(envio.created_at)}
      </p>
    </div>
  );
}
