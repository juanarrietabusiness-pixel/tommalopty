import { describe, expect, it } from 'vitest';
import { nombreDeDireccion } from './notificaciones';
import { orderConfirmationEmail, orderReceivedEmail, orderShippedEmail } from './templates';

const BASE = {
  brandName: 'Nébula Store',
  orderNumber: 'NB-000123',
  customerName: 'Ana Pérez',
  total: '$49.90',
  items: [{ title: 'Café Orgánico 250g', quantity: 2, total: '$29.80' }],
  orderUrl: 'https://tienda.test/checkout/confirmacion/abc123',
};

describe('plantillas de correo', () => {
  it('el correo de pedido recibido NO dice que esté confirmado', () => {
    // Hasta que la pasarela confirme el cobro, decirlo es mentira, y si el pago
    // falla luego hay que desdecirse delante del cliente.
    const { subject, html } = orderReceivedEmail(BASE);
    expect(subject).toBe('Hemos recibido tu pedido NB-000123');
    expect(subject.toLowerCase()).not.toContain('confirmado');
    expect(html).toContain('en cuanto se\n      confirme el pago');
  });

  it('el correo de pago confirmado sí lo afirma', () => {
    const { subject, html } = orderConfirmationEmail(BASE);
    expect(subject).toContain('confirmado');
    expect(html).toContain('está pagado y confirmado');
  });

  it('las dos plantillas listan los artículos y el total', () => {
    for (const plantilla of [orderReceivedEmail(BASE), orderConfirmationEmail(BASE)]) {
      expect(plantilla.html).toContain('Café Orgánico 250g');
      expect(plantilla.html).toContain('$49.90');
      expect(plantilla.html).toContain(BASE.orderUrl);
    }
  });

  it('escapa el nombre del cliente: sale de un formulario público', () => {
    const html = orderReceivedEmail({
      ...BASE,
      customerName: '<img src=x onerror=alert(1)>Ana',
    }).html;

    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x');
  });

  it('escapa el título del producto: lo escribe el panel', () => {
    const html = orderConfirmationEmail({
      ...BASE,
      items: [{ title: 'Camiseta <b>XL</b> & co', quantity: 1, total: '$10.00' }],
    }).html;

    expect(html).toContain('Camiseta &lt;b&gt;XL&lt;/b&gt; &amp; co');
  });

  it('escapa el enlace para que no pueda salirse del atributo href', () => {
    const html = orderReceivedEmail({
      ...BASE,
      orderUrl: 'https://tienda.test/x" onclick="robar()',
    }).html;

    expect(html).not.toContain('" onclick="robar()');
    expect(html).toContain('&quot; onclick=&quot;robar()');
  });

  it('el correo de envío solo pinta el botón si hay seguimiento', () => {
    const sin = orderShippedEmail({ ...BASE });
    const con = orderShippedEmail({ ...BASE, trackingUrl: 'https://correo.test/x' });

    expect(sin.html).not.toContain('Seguir mi envío');
    expect(con.html).toContain('https://correo.test/x');
  });
});

describe('nombre desde la dirección de envío', () => {
  it('lo extrae de la instantánea jsonb', () => {
    expect(nombreDeDireccion({ firstName: 'Ana', lastName: 'Pérez' })).toEqual({
      firstName: 'Ana',
      lastName: 'Pérez',
    });
  });

  it('aguanta un pedido sin dirección o con basura dentro', () => {
    // Un pedido creado a mano desde el panel puede no tener dirección, y el
    // saludo del correo no puede ser el motivo de que no salga el aviso.
    expect(nombreDeDireccion(null)).toEqual({});
    expect(nombreDeDireccion('no soy un objeto')).toEqual({});
    expect(nombreDeDireccion({ firstName: 42 })).toEqual({
      firstName: undefined,
      lastName: undefined,
    });
  });
});
