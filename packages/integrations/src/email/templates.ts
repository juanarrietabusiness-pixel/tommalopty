/**
 * Plantillas de email transaccional.
 *
 * HTML inline y sobrio a propósito: los clientes de correo no soportan CSS
 * moderno. Los colores replican los tokens de la tienda.
 */
const PRIMARY = '#173c2e';
const ACCENT = '#ff5a1f';

/**
 * Escapa lo que se interpola en el HTML del correo.
 *
 * El nombre del cliente viene del formulario de checkout y los títulos del
 * catálogo los escribe el panel: los dos acaban dentro del marcado. Sin esto,
 * un nombre con `<` rompe la maquetación del correo, y uno con una etiqueta
 * entera puede colar un enlace en un mensaje que el cliente lee como nuestro.
 */
function esc(value: string | number): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function layout(brandName: string, title: string, body: string): string {
  return `<!doctype html>
<html lang="es">
  <body style="margin:0;padding:0;background:#f7f7f5;font-family:Arial,Helvetica,sans-serif;color:#141414;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="background:${PRIMARY};padding:24px;text-align:center;color:#ffffff;font-weight:bold;letter-spacing:1px;text-transform:uppercase;">
                ${esc(brandName)}
              </td>
            </tr>
            <tr>
              <td style="padding:32px 28px;">
                <h1 style="margin:0 0 16px;font-size:20px;text-transform:uppercase;">${esc(title)}</h1>
                ${body}
              </td>
            </tr>
            <tr>
              <td style="padding:20px 28px;background:#101410;color:#9aa094;font-size:12px;text-align:center;">
                © ${new Date().getFullYear()} ${esc(brandName)}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function filasDeArticulos(items: { title: string; quantity: number; total: string }[]): string {
  return items
    .map(
      (item) => `<tr>
        <td style="padding:8px 0;border-bottom:1px solid #e6e6e2;font-size:14px;">${esc(item.title)} × ${esc(item.quantity)}</td>
        <td style="padding:8px 0;border-bottom:1px solid #e6e6e2;font-size:14px;text-align:right;">${esc(item.total)}</td>
      </tr>`,
    )
    .join('');
}

export interface OrderConfirmationData {
  brandName: string;
  orderNumber: string;
  customerName: string;
  total: string;
  items: { title: string; quantity: number; total: string }[];
  orderUrl: string;
}

export function orderConfirmationEmail(data: OrderConfirmationData): {
  subject: string;
  html: string;
} {
  const body = `
    <p style="font-size:14px;line-height:1.6;">Hola ${esc(data.customerName)}, tu pedido
      <strong>${esc(data.orderNumber)}</strong> está pagado y confirmado. Te avisaremos en cuanto
      salga hacia tu dirección.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
      ${filasDeArticulos(data.items)}
      <tr>
        <td style="padding:12px 0;font-size:16px;font-weight:bold;">Total</td>
        <td style="padding:12px 0;font-size:16px;font-weight:bold;text-align:right;color:${ACCENT};">${esc(data.total)}</td>
      </tr>
    </table>
    <p style="text-align:center;margin:28px 0 0;">
      <a href="${esc(data.orderUrl)}" style="background:${PRIMARY};color:#ffffff;padding:13px 28px;border-radius:999px;text-decoration:none;font-size:13px;text-transform:uppercase;font-weight:bold;">Ver mi pedido</a>
    </p>`;

  return {
    subject: `Pedido ${data.orderNumber} confirmado`,
    html: layout(data.brandName, 'Gracias por tu compra', body),
  };
}

/**
 * El pedido entró, el cobro todavía no está confirmado.
 *
 * Es el correo que la pantalla de confirmación promete al terminar el checkout.
 * Deliberadamente NO dice "confirmado": mientras la pasarela no confirme el
 * cobro, decirlo sería mentir al cliente, y si luego el pago falla habría que
 * desdecirse.
 */
export function orderReceivedEmail(data: OrderConfirmationData): {
  subject: string;
  html: string;
} {
  const body = `
    <p style="font-size:14px;line-height:1.6;">Hola ${esc(data.customerName)}, hemos recibido tu
      pedido <strong>${esc(data.orderNumber)}</strong>. Te escribiremos de nuevo en cuanto se
      confirme el pago.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
      ${filasDeArticulos(data.items)}
      <tr>
        <td style="padding:12px 0;font-size:16px;font-weight:bold;">Total</td>
        <td style="padding:12px 0;font-size:16px;font-weight:bold;text-align:right;color:${ACCENT};">${esc(data.total)}</td>
      </tr>
    </table>
    <p style="text-align:center;margin:28px 0 0;">
      <a href="${esc(data.orderUrl)}" style="background:${PRIMARY};color:#ffffff;padding:13px 28px;border-radius:999px;text-decoration:none;font-size:13px;text-transform:uppercase;font-weight:bold;">Ver mi pedido</a>
    </p>`;

  return {
    subject: `Hemos recibido tu pedido ${data.orderNumber}`,
    html: layout(data.brandName, 'Pedido recibido', body),
  };
}

export function orderShippedEmail(data: {
  brandName: string;
  orderNumber: string;
  customerName: string;
  trackingUrl?: string;
}): { subject: string; html: string } {
  const body = `
    <p style="font-size:14px;line-height:1.6;">Hola ${esc(data.customerName)}, tu pedido
      <strong>${esc(data.orderNumber)}</strong> ya está en camino.</p>
    ${
      data.trackingUrl
        ? `<p style="text-align:center;margin:28px 0 0;">
             <a href="${esc(data.trackingUrl)}" style="background:${PRIMARY};color:#ffffff;padding:13px 28px;border-radius:999px;text-decoration:none;font-size:13px;text-transform:uppercase;font-weight:bold;">Seguir mi envío</a>
           </p>`
        : ''
    }`;

  return {
    subject: `Tu pedido ${data.orderNumber} va en camino`,
    html: layout(data.brandName, 'Pedido enviado', body),
  };
}
