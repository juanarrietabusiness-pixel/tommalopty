'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { money, useCart } from '@nebula/ui';

export interface ShippingMethodOption {
  id: string;
  name: string;
  description: string | null;
  price: number;
  freeAboveSubtotal: number | null;
}

export interface PaymentOption {
  id: string;
  label: string;
  methods: readonly string[];
  isConfigured: boolean;
}

const METHOD_LABELS: Record<string, string> = {
  card: 'Tarjetas de crédito y débito',
  paypal: 'Saldo PayPal',
  clave: 'Clave (débito local)',
  qr: 'Pago por QR',
};

/**
 * Formulario de checkout.
 *
 * No conoce ninguna pasarela: solo envía el pedido a /api/checkout, que decide
 * qué integración usar. Añadir Yappy o PagueloFacil no toca este archivo.
 */
export function CheckoutForm({
  shippingMethods,
  paymentOptions,
}: {
  shippingMethods: ShippingMethodOption[];
  paymentOptions: PaymentOption[];
}) {
  const router = useRouter();
  const { lines, subtotal, clear, isHydrated } = useCart();

  const [shippingMethodId, setShippingMethodId] = useState(shippingMethods[0]?.id ?? '');
  const [paymentProvider, setPaymentProvider] = useState(
    paymentOptions.find((option) => option.isConfigured)?.id ?? paymentOptions[0]?.id ?? '',
  );
  const [discountCode, setDiscountCode] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending'>('idle');
  const [error, setError] = useState<string | null>(null);

  const selectedMethod = shippingMethods.find((method) => method.id === shippingMethodId);
  const shippingCost =
    selectedMethod &&
    selectedMethod.freeAboveSubtotal !== null &&
    subtotal >= selectedMethod.freeAboveSubtotal
      ? 0
      : (selectedMethod?.price ?? 0);
  const total = subtotal + shippingCost;

  if (isHydrated && lines.length === 0) {
    return (
      <div className="notice notice-info">
        Tu carrito está vacío. <a href="/tienda">Vuelve a la tienda</a> para añadir productos.
      </div>
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('sending');
    setError(null);

    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: formData.get('email'),
          phone: formData.get('phone') || undefined,
          shippingAddress: {
            firstName: formData.get('firstName'),
            lastName: formData.get('lastName'),
            line1: formData.get('line1'),
            line2: formData.get('line2') || undefined,
            city: formData.get('city'),
            province: formData.get('province') || undefined,
            countryCode: 'PA',
            phone: formData.get('phone') || undefined,
          },
          shippingMethodId: shippingMethodId || undefined,
          paymentProvider,
          discountCode: discountCode || undefined,
          customerNote: formData.get('customerNote') || undefined,
          lines: lines.map((line) => ({ variantId: line.variantId, quantity: line.quantity })),
        }),
      });

      const result = (await response.json()) as {
        orderNumber?: string;
        redirectUrl?: string;
        message?: string;
        reason?: string;
        error?: string;
      };

      if (response.ok) {
        clear();
        if (result.redirectUrl) {
          window.location.href = result.redirectUrl;
          return;
        }
        router.push(`/checkout/confirmacion/${result.orderNumber}`);
        return;
      }

      setError(result.message ?? result.reason ?? 'No pudimos completar el pedido.');
    } catch {
      setError('Hubo un problema de conexión. Revisa tu red e inténtalo de nuevo.');
    } finally {
      setStatus('idle');
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="checkout-layout">
        <div>
          {error ? <div className="notice notice-error">{error}</div> : null}

          <section className="checkout-block">
            <h2>1 · Contacto</h2>
            <div className="field">
              <label htmlFor="email">Correo electrónico</label>
              <input id="email" name="email" type="email" required placeholder="tu@correo.com" />
              <span className="field-hint">Te enviaremos aquí la confirmación del pedido.</span>
            </div>
            <div className="field">
              <label htmlFor="phone">Teléfono (opcional)</label>
              <input id="phone" name="phone" type="tel" placeholder="6123-4567" />
            </div>
          </section>

          <section className="checkout-block">
            <h2>2 · Dirección de envío</h2>
            <div className="field-row">
              <div className="field">
                <label htmlFor="firstName">Nombre</label>
                <input id="firstName" name="firstName" required />
              </div>
              <div className="field">
                <label htmlFor="lastName">Apellido</label>
                <input id="lastName" name="lastName" required />
              </div>
            </div>
            <div className="field">
              <label htmlFor="line1">Dirección</label>
              <input id="line1" name="line1" required />
            </div>
            <div className="field">
              <label htmlFor="line2">Apartamento, casa, referencia (opcional)</label>
              <input id="line2" name="line2" />
            </div>
            <div className="field-row">
              <div className="field">
                <label htmlFor="city">Ciudad</label>
                <input id="city" name="city" required />
              </div>
              <div className="field">
                <label htmlFor="province">Provincia</label>
                <input id="province" name="province" />
              </div>
            </div>
          </section>

          <section className="checkout-block">
            <h2>3 · Envío</h2>
            <div className="payment-methods">
              {shippingMethods.map((method) => (
                <label
                  key={method.id}
                  className="payment-method"
                  data-selected={method.id === shippingMethodId}
                >
                  <input
                    type="radio"
                    name="shippingMethod"
                    value={method.id}
                    checked={method.id === shippingMethodId}
                    onChange={() => setShippingMethodId(method.id)}
                  />
                  <span className="method-info">
                    <strong>{method.name}</strong>
                    <span>{method.description}</span>
                  </span>
                  <strong>
                    {method.freeAboveSubtotal !== null && subtotal >= method.freeAboveSubtotal
                      ? 'Gratis'
                      : money(method.price)}
                  </strong>
                </label>
              ))}
            </div>
          </section>

          <section className="checkout-block">
            <h2>4 · Pago</h2>
            <div className="payment-methods">
              {paymentOptions.map((option) => (
                <label
                  key={option.id}
                  className="payment-method"
                  data-selected={option.id === paymentProvider}
                  data-available={option.isConfigured}
                >
                  <input
                    type="radio"
                    name="paymentProvider"
                    value={option.id}
                    checked={option.id === paymentProvider}
                    onChange={() => setPaymentProvider(option.id)}
                  />
                  <span className="method-info">
                    <strong>{option.label}</strong>
                    <span>
                      {option.isConfigured
                        ? option.methods
                            .map((method) => METHOD_LABELS[method] ?? method)
                            .join(' · ')
                        : 'Pendiente de configurar credenciales'}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            <p className="field-hint" style={{ marginTop: 14 }}>
              Los datos de tu tarjeta se introducen en el entorno seguro de la pasarela: esta tienda
              nunca los recibe ni los almacena.
            </p>
          </section>

          <div className="field">
            <label htmlFor="customerNote">Nota para el pedido (opcional)</label>
            <textarea id="customerNote" name="customerNote" maxLength={500} />
          </div>
        </div>

        <aside className="summary-card">
          <h2>Tu pedido</h2>

          {lines.map((line) => (
            <div className="summary-row" key={line.variantId}>
              <span>
                {line.title} × {line.quantity}
              </span>
              <span>{money(line.price * line.quantity)}</span>
            </div>
          ))}

          <div className="discount-row">
            <input
              type="text"
              placeholder="Código de descuento"
              value={discountCode}
              onChange={(event) => setDiscountCode(event.target.value)}
              aria-label="Código de descuento"
            />
          </div>

          <div className="summary-row">
            <span>Subtotal</span>
            <span>{money(subtotal)}</span>
          </div>
          <div className="summary-row">
            <span>Envío</span>
            <span>{shippingCost === 0 ? 'Gratis' : money(shippingCost)}</span>
          </div>
          <div className="summary-row total">
            <span>Total</span>
            <span>{money(total)}</span>
          </div>

          <button
            type="submit"
            className="btn btn-dark"
            style={{ width: '100%', marginTop: 18 }}
            disabled={status === 'sending' || lines.length === 0}
          >
            {status === 'sending' ? 'Procesando…' : 'Confirmar pedido'}
          </button>
          <p className="field-hint" style={{ marginTop: 12, textAlign: 'center' }}>
            El descuento se valida en el servidor al confirmar.
          </p>
        </aside>
      </div>
    </form>
  );
}
