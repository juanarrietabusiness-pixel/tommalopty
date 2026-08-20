import { resendProvider } from './resend';
import { orderConfirmationEmail, orderReceivedEmail, orderShippedEmail } from './templates';
import type { SendEmailResult } from './types';

/**
 * Los correos que la tienda envía en cada evento de un pedido.
 *
 * Vive aquí y no en cada app porque tienda y panel disparan eventos distintos
 * del mismo pedido —recibido y pagado desde la tienda, enviado desde el panel—
 * y el texto que recibe el cliente tiene que ser el mismo venga de donde venga.
 *
 * Ninguna de estas funciones lanza. Un correo que no sale no puede tumbar un
 * checkout ni impedir que un pedido cambie de estado: el pedido es el hecho, el
 * correo es el aviso. Quien llama decide si registra el fallo.
 */

const LOCALE = 'es-PA';

function money(value: number): string {
  return new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency: 'USD',
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function brandName(): string {
  return process.env.NEXT_PUBLIC_BRAND_NAME?.trim() || 'Nébula Store';
}

/** Nombre para encabezar el correo, con salida digna si no hay datos. */
function saludo(firstName?: string | null, lastName?: string | null): string {
  const nombre = [firstName, lastName].filter(Boolean).join(' ').trim();
  return nombre.length > 0 ? nombre : 'hola';
}

/**
 * Saca el nombre del comprador de la instantánea de la dirección de envío.
 *
 * `orders.shipping_address` es jsonb, así que llega sin tipar y puede estar
 * vacía en un pedido antiguo o creado a mano desde el panel. Lo usan la tienda
 * (webhook de pago) y el panel (aviso de envío): mismo pedido, mismo saludo.
 */
export function nombreDeDireccion(direccion: unknown): {
  firstName?: string;
  lastName?: string;
} {
  if (typeof direccion !== 'object' || direccion === null) return {};
  const campos = direccion as Record<string, unknown>;
  return {
    firstName: typeof campos.firstName === 'string' ? campos.firstName : undefined,
    lastName: typeof campos.lastName === 'string' ? campos.lastName : undefined,
  };
}

export interface LineaPedidoEmail {
  title: string;
  quantity: number;
  total: number;
}

export interface DatosPedidoEmail {
  orderNumber: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  total: number;
  items: LineaPedidoEmail[];
  /** Enlace a la confirmación, que se autentica con el token opaco. */
  orderUrl: string;
}

async function enviar(
  to: string,
  plantilla: { subject: string; html: string },
): Promise<SendEmailResult> {
  try {
    return await resendProvider.send({
      to: { email: to },
      subject: plantilla.subject,
      html: plantilla.html,
    });
  } catch (error) {
    return {
      sent: false,
      reason: error instanceof Error ? error.message : 'email_error',
    };
  }
}

/**
 * El pedido entró pero todavía no está cobrado.
 *
 * Es el correo que la pantalla de confirmación lleva prometiendo desde el
 * primer día. Dice "hemos recibido", no "confirmado": mientras la pasarela no
 * confirme el cobro, decir que está confirmado es mentira.
 */
export async function enviarPedidoRecibido(datos: DatosPedidoEmail): Promise<SendEmailResult> {
  return enviar(
    datos.email,
    orderReceivedEmail({
      brandName: brandName(),
      orderNumber: datos.orderNumber,
      customerName: saludo(datos.firstName, datos.lastName),
      total: money(datos.total),
      items: datos.items.map((item) => ({
        title: item.title,
        quantity: item.quantity,
        total: money(item.total),
      })),
      orderUrl: datos.orderUrl,
    }),
  );
}

/** La pasarela confirmó el cobro y el importe cuadra con el pedido. */
export async function enviarPagoConfirmado(datos: DatosPedidoEmail): Promise<SendEmailResult> {
  return enviar(
    datos.email,
    orderConfirmationEmail({
      brandName: brandName(),
      orderNumber: datos.orderNumber,
      customerName: saludo(datos.firstName, datos.lastName),
      total: money(datos.total),
      items: datos.items.map((item) => ({
        title: item.title,
        quantity: item.quantity,
        total: money(item.total),
      })),
      orderUrl: datos.orderUrl,
    }),
  );
}

/** El pedido salió hacia la dirección del cliente. */
export async function enviarPedidoEnviado(datos: {
  orderNumber: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  trackingUrl?: string;
}): Promise<SendEmailResult> {
  return enviar(
    datos.email,
    orderShippedEmail({
      brandName: brandName(),
      orderNumber: datos.orderNumber,
      customerName: saludo(datos.firstName, datos.lastName),
      trackingUrl: datos.trackingUrl,
    }),
  );
}
