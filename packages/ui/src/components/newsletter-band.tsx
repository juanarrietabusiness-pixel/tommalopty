'use client';

import { useState, type FormEvent } from 'react';

/**
 * Banda de captación previa al footer.
 * Envía el email a un Route Handler que lo registra en `leads` y lo reenvía al
 * proveedor de email marketing.
 */
export interface NewsletterBandProps {
  title?: string | null;
  subtitle?: string | null;
  ctaLabel?: string | null;
  endpoint?: string;
  source?: string;
}

export function NewsletterBand({
  title,
  subtitle,
  ctaLabel = 'Suscribirme',
  endpoint = '/api/newsletter',
  source = 'newsletter_footer',
}: NewsletterBandProps) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  // La trampa para bots (#9). Una persona nunca la rellena porque no la ve; un
  // bot que rellena todo lo que encuentra, sí. El servidor descarta el alta en
  // silencio si viene con algo.
  const [trampa, setTrampa] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState('sending');
    setMessage(null);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, source, website: trampa }),
      });

      // 429: se ha pedido demasiadas veces desde esta conexión. Merece un
      // mensaje propio, porque «inténtalo de nuevo en un momento» es
      // literalmente lo que hay que hacer, y el genérico no lo dice.
      if (response.status === 429) {
        setState('error');
        setMessage('Demasiados intentos desde esta conexión. Prueba de nuevo en un rato.');
        return;
      }

      if (!response.ok) throw new Error('request_failed');

      setState('done');
      setMessage('¡Listo! Revisa tu correo para confirmar la suscripción.');
      setEmail('');
    } catch {
      setState('error');
      setMessage('No pudimos completar la suscripción. Inténtalo de nuevo en un momento.');
    }
  }

  return (
    <section className="cta-band">
      <div className="container">
        <h2>{title ?? 'Únete y recibe -10% en tu primera compra'}</h2>
        <p>
          {subtitle ?? 'Suscríbete para enterarte de nuevos lanzamientos y ofertas exclusivas.'}
        </p>
        <form className="newsletter-form" onSubmit={handleSubmit}>
          <label className="visually-hidden" htmlFor="newsletterEmail">
            Correo electrónico
          </label>
          <input
            id="newsletterEmail"
            type="email"
            // Sin esto, quien se suscribe desde el móvil teclea su correo entero
            // aunque el teléfono ya lo sepa. Es un campo, y es el único de la
            // tienda al que le faltaba.
            autoComplete="email"
            placeholder="tu@correo.com"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          {/*
            El campo trampa. `aria-hidden` y `tabIndex={-1}` lo sacan del
            recorrido de teclado y de los lectores de pantalla: quien navega sin
            ver la página tampoco debe encontrarse con él, o sería una trampa
            para la persona equivocada. `autoComplete="off"` evita que el
            navegador lo rellene solo.
          */}
          <input
            type="text"
            name="website"
            tabIndex={-1}
            aria-hidden="true"
            autoComplete="off"
            className="visually-hidden"
            value={trampa}
            onChange={(event) => setTrampa(event.target.value)}
          />

          <button type="submit" className="btn btn-accent" disabled={state === 'sending'}>
            {state === 'sending' ? 'Enviando…' : ctaLabel}
          </button>
        </form>
        {message ? (
          <p className="newsletter-message" role="status">
            {message}
          </p>
        ) : null}
      </div>
    </section>
  );
}
