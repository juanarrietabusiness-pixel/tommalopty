/**
 * Plantillas de email transaccional.
 *
 * HTML inline y sobrio a propósito: los clientes de correo no soportan CSS
 * moderno. Los colores replican los tokens de la tienda.
 */
const PRIMARY = '#173c2e';
const ACCENT = '#ff5a1f';

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
                ${brandName}
              </td>
            </tr>
            <tr>
              <td style="padding:32px 28px;">
                <h1 style="margin:0 0 16px;font-size:20px;text-transform:uppercase;">${title}</h1>
                ${body}
              </td>
            </tr>
            <tr>
              <td style="padding:20px 28px;background:#101410;color:#9aa094;font-size:12px;text-align:center;">
                © ${new Date().getFullYear()} ${brandName}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export interface OrderConfirmationData {
  brandName: string;
  orderNumber: string;
  customerName: string;
  total: string;
  items: { title: string; quantity: number; total: string }[];
  orderUrl: string;
}

export function orderConfirmationEmail(data: OrderConfirmationData): { subject: string; html: string } {
  const rows = data.items
    .map(
      (item) => `<tr>
        <td style="padding:8px 0;border-bottom:1px solid #e6e6e2;font-size:14px;">${item.title} × ${item.quantity}</td>
        <td style="padding:8px 0;border-bottom:1px solid #e6e6e2;font-size:14px;text-align:right;">${item.total}</td>
      </tr>`,
    )
    .join('');

  const body = `
    <p style="font-size:14px;line-height:1.6;">Hola ${data.customerName}, hemos recibido tu pedido
      <strong>${data.orderNumber}</strong>. Te avisaremos en cuanto salga hacia tu dirección.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
      ${rows}
      <tr>
        <td style="padding:12px 0;font-size:16px;font-weight:bold;">Total</td>
        <td style="padding:12px 0;font-size:16px;font-weight:bold;text-align:right;color:${ACCENT};">${data.total}</td>
      </tr>
    </table>
    <p style="text-align:center;margin:28px 0 0;">
      <a href="${data.orderUrl}" style="background:${PRIMARY};color:#ffffff;padding:13px 28px;border-radius:999px;text-decoration:none;font-size:13px;text-transform:uppercase;font-weight:bold;">Ver mi pedido</a>
    </p>`;

  return {
    subject: `Pedido ${data.orderNumber} confirmado`,
    html: layout(data.brandName, 'Gracias por tu compra', body),
  };
}

export function orderShippedEmail(data: {
  brandName: string;
  orderNumber: string;
  customerName: string;
  trackingUrl?: string;
}): { subject: string; html: string } {
  const body = `
    <p style="font-size:14px;line-height:1.6;">Hola ${data.customerName}, tu pedido
      <strong>${data.orderNumber}</strong> ya está en camino.</p>
    ${
      data.trackingUrl
        ? `<p style="text-align:center;margin:28px 0 0;">
             <a href="${data.trackingUrl}" style="background:${PRIMARY};color:#ffffff;padding:13px 28px;border-radius:999px;text-decoration:none;font-size:13px;text-transform:uppercase;font-weight:bold;">Seguir mi envío</a>
           </p>`
        : ''
    }`;

  return {
    subject: `Tu pedido ${data.orderNumber} va en camino`,
    html: layout(data.brandName, 'Pedido enviado', body),
  };
}
