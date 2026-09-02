'use client';

import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Meta Pixel (lado cliente).
 *
 * Se complementa con la Conversions API en servidor: los eventos de compra se
 * envían por ambos canales con el mismo `event_id` para que Meta los deduplique
 * y no se pierdan por bloqueadores de anuncios (brief §2).
 */
declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

/**
 * El identificador llega **como prop y no de `process.env`**, y esa es toda la
 * diferencia entre poder cambiarlo desde el panel o no.
 *
 * `NEXT_PUBLIC_*` se sustituye en compilación: leído aquí, pegar el píxel en
 * Integraciones no habría hecho nada hasta el siguiente despliegue. Quien lo
 * lee ahora es un componente de servidor, en cada petición.
 */
export function MetaPixel({ pixelId }: { pixelId: string | null }) {
  const pathname = usePathname();

  // El App Router no recarga la página entre rutas: hay que emitir PageView.
  useEffect(() => {
    if (!pixelId || typeof window.fbq !== 'function') return;
    window.fbq('track', 'PageView');
  }, [pathname, pixelId]);

  if (!pixelId) return null;

  return (
    <Script id="meta-pixel" strategy="afterInteractive">
      {`!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window,document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${pixelId}');
fbq('track', 'PageView');`}
    </Script>
  );
}

/** Dispara un evento del Pixel reutilizando el `event_id` del servidor. */
export function trackPixelEvent(
  eventName: string,
  eventId: string,
  data?: Record<string, unknown>,
): void {
  if (typeof window === 'undefined' || typeof window.fbq !== 'function') return;
  window.fbq('track', eventName, data ?? {}, { eventID: eventId });
}
