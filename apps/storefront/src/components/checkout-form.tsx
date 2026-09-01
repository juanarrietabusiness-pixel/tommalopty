'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import type { DeliveryZone, DireccionAproximada } from '@nebula/domain';
import { money, useCart } from '@nebula/ui';
import { SelectorDeUbicacion, type UbicacionElegida } from '@/components/selector-de-ubicacion';
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
  deliveryZones = [],
}: {
  shippingMethods: ShippingMethodOption[];
  paymentOptions: PaymentOption[];
  deliveryZones?: DeliveryZone[];
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

  // La coordenada es el dato que de verdad localiza la entrega; el texto de la
  // dirección la acompaña. Se guarda aparte del `FormData` porque el mapa no es
  // un campo de formulario.
  const [ubicacion, setUbicacion] = useState<UbicacionElegida | null>(null);

  // `useCallback` porque el selector la tiene en las dependencias de un efecto:
  // sin memorizar, cada render de este formulario —y hay uno por tecla del
  // cupón— reiniciaría ese efecto.
  const recibirUbicacion = useCallback((valor: UbicacionElegida | null) => {
    setUbicacion(valor);
  }, []);

  /*
   * LOS CAMPOS DE DIRECCIÓN LOS ESCRIBE EL MAPA, Y LOS CORRIGE QUIEN COMPRA
   *
   * Dejaron de ser campos sin control porque el mapa tiene que poder rellenarlos.
   * Pero rellenar no es imponer: en cuanto alguien escribe en uno, ese campo pasa
   * a ser suyo y ningún movimiento posterior del pin lo vuelve a tocar. Sin esa
   * regla, corregir «Bella Vista» por el nombre real de la barriada y mover
   * después el mapa un metro te borraba la corrección, y eso se siente como que
   * la página pelea contigo.
   *
   * Se lleva en un `ref` y no en estado porque no cambia lo que se pinta: solo
   * decide si el siguiente volcado puede tocar el campo.
   */
  const [direccion, setDireccion] = useState({ line1: '', city: '', province: '' });
  const escritosAMano = useRef(new Set<string>());
  const [rellenadaDesdeElMapa, setRellenadaDesdeElMapa] = useState(false);

  function editarCampo(campo: 'line1' | 'city' | 'province', valor: string) {
    escritosAMano.current.add(campo);
    setDireccion((actual) => ({ ...actual, [campo]: valor }));
  }

  const recibirDireccion = useCallback((sugerida: DireccionAproximada) => {
    setDireccion((actual) => {
      const tomar = (campo: 'line1' | 'city' | 'province') =>
        escritosAMano.current.has(campo) ? actual[campo] : (sugerida[campo] ?? actual[campo]);

      return {
        line1: tomar('line1'),
        city: tomar('city'),
        province: tomar('province'),
      };
    });

    setRellenadaDesdeElMapa(true);
  }, []);

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
            latitude: ubicacion?.lat,
            longitude: ubicacion?.lng,
            locationPrecision: ubicacion?.precision,
            reference: ubicacion?.reference || undefined,
            deliveryInstructions: ubicacion?.deliveryInstructions || undefined,
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
              <input
                id="line1"
                name="line1"
                required
                value={direccion.line1}
                onChange={(evento) => editarCampo('line1', evento.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="line2">Apartamento, casa, referencia (opcional)</label>
              <input id="line2" name="line2" />
            </div>
            <div className="field-row">
              <div className="field">
                <label htmlFor="city">Ciudad</label>
                <input
                  id="city"
                  name="city"
                  required
                  value={direccion.city}
                  onChange={(evento) => editarCampo('city', evento.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="province">Provincia</label>
                <input
                  id="province"
                  name="province"
                  value={direccion.province}
                  onChange={(evento) => editarCampo('province', evento.target.value)}
                />
              </div>
            </div>

            {/*
              Se dice solo cuando ha pasado. Un aviso permanente de «esto se
              rellena solo» delante de tres campos vacíos es una promesa que la
              pantalla todavía no ha cumplido.
            */}
            {rellenadaDesdeElMapa ? (
              <p className="field-hint" data-testid="aviso-autocompletado" role="status">
                Completamos estos campos con el punto que marcaste. Corrígelos si no cuadran: lo que
                escribas tú manda.
              </p>
            ) : null}

            <h3 className="checkout-subtitulo">Marca el punto exacto de entrega</h3>
            <p className="field-hint" style={{ marginTop: -6, marginBottom: 12 }}>
              En Panamá la dirección escrita casi nunca basta para encontrar una puerta. El punto
              del mapa es lo que ve quien te lleva el pedido, y con él rellenamos la dirección de
              arriba.
            </p>
            <SelectorDeUbicacion
              zonas={deliveryZones}
              onCambio={recibirUbicacion}
              onDireccion={recibirDireccion}
            />
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
