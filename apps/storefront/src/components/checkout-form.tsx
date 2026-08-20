'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { money, useCart } from '@nebula/ui';
import type { Cotizacion } from '@/app/api/checkout/cotizar/route';

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

  // Los totales los calcula el servidor, nunca este componente: aquí no se
  // conocen los precios reales del catálogo ni cuánto descuenta un cupón, y
  // adivinarlos hacía que la pantalla mostrara un importe y se cobrara otro.
  const [cotizacion, setCotizacion] = useState<Cotizacion | null>(null);
  const [cotizando, setCotizando] = useState(false);
  const peticionRef = useRef(0);

  useEffect(() => {
    if (!isHydrated || lines.length === 0) return;

    const peticion = ++peticionRef.current;
    const controlador = new AbortController();

    // Se espera a que la persona deje de teclear el cupón antes de consultar.
    const temporizador = window.setTimeout(() => {
      setCotizando(true);

      void fetch('/api/checkout/cotizar', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: controlador.signal,
        body: JSON.stringify({
          lines: lines.map((line) => ({ variantId: line.variantId, quantity: line.quantity })),
          shippingMethodId: shippingMethodId || undefined,
          discountCode: discountCode.trim() || undefined,
        }),
      })
        .then((response) => (response.ok ? (response.json() as Promise<Cotizacion>) : null))
        .then((datos) => {
          // Una respuesta que llega tarde no debe pisar a una más reciente.
          if (peticion === peticionRef.current) setCotizacion(datos);
        })
        .catch(() => {
          if (peticion === peticionRef.current) setCotizacion(null);
        })
        .finally(() => {
          if (peticion === peticionRef.current) setCotizando(false);
        });
    }, 400);

    return () => {
      window.clearTimeout(temporizador);
      controlador.abort();
    };
  }, [lines, shippingMethodId, discountCode, isHydrated]);

  // Con el carrito vacío no hay cotización que mostrar. Se deriva en el render
  // en lugar de limpiarla desde el efecto.
  const resumen = lines.length > 0 ? cotizacion : null;

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
        confirmationToken?: string;
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
        router.push(`/checkout/confirmacion/${result.confirmationToken}`);
        return;
      }

      // Un pedido registrado sin pasarela conectada sigue siendo un pedido:
      // se lleva al cliente a su confirmación en lugar de dejarlo en el aire.
      if (result.confirmationToken) {
        clear();
        router.push(`/checkout/confirmacion/${result.confirmationToken}`);
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

          {resumen?.discount ? (
            <p
              className={resumen.discount.applied ? 'field-hint' : 'field-error'}
              role="status"
              style={{ marginTop: -8, marginBottom: 12 }}
            >
              {resumen.discount.applied
                ? `Código aplicado: −${money(resumen.discountTotal)}`
                : resumen.discount.reason}
            </p>
          ) : null}

          <div className="summary-row">
            <span>Subtotal</span>
            <span>{money(resumen?.subtotal ?? subtotal)}</span>
          </div>

          {resumen && resumen.discountTotal > 0 ? (
            <div className="summary-row">
              <span>Descuento</span>
              <span>−{money(resumen.discountTotal)}</span>
            </div>
          ) : null}

          <div className="summary-row">
            <span>Envío</span>
            <span>
              {resumen
                ? resumen.shippingTotal === 0
                  ? 'Gratis'
                  : money(resumen.shippingTotal)
                : 'Se calcula al confirmar'}
            </span>
          </div>

          <div className="summary-row total">
            <span>Total</span>
            <span aria-live="polite">
              {cotizando ? 'Calculando…' : resumen ? money(resumen.total) : money(subtotal)}
            </span>
          </div>

          <button
            type="submit"
            className="btn btn-dark"
            style={{ width: '100%', marginTop: 18 }}
            disabled={status === 'sending' || cotizando || lines.length === 0}
          >
            {status === 'sending' ? 'Procesando…' : 'Confirmar pedido'}
          </button>
          {/*
            `data-testid` porque el test que vigila esta nota es la regresión del
            bug de "la pantalla dice un total y se cobra otro". Localizarla por
            posición la rompía en cuanto se añadía cualquier párrafo debajo.
          */}
          <p
            className="field-hint"
            data-testid="nota-total"
            style={{ marginTop: 12, textAlign: 'center' }}
          >
            {resumen
              ? 'Este es el importe exacto que se cobrará.'
              : 'El importe final se confirma en el servidor.'}
          </p>
          {/*
            La aceptación tiene que estar a la vista en el momento de confirmar,
            no escondida en el pie: es lo que exige la protección al consumidor y
            lo que revisa una pasarela antes de aprobar el comercio.
          */}
          <p className="field-hint" style={{ marginTop: 8, textAlign: 'center' }}>
            Al confirmar el pedido aceptas los{' '}
            <a href="/p/terminos" target="_blank" rel="noreferrer">
              términos y condiciones
            </a>{' '}
            y la{' '}
            <a href="/p/privacidad" target="_blank" rel="noreferrer">
              política de privacidad
            </a>
            .
          </p>
        </aside>
      </div>
    </form>
  );
}
