'use client';

import { useEffect, useRef } from 'react';
import { trackPixelEvent } from './meta-pixel';

/**
 * Los eventos del píxel que dependen de haber llegado a una página.
 *
 * Por qué existe un componente y no una llamada suelta en cada sitio: `PageView`
 * ya lo emite el propio píxel, pero `ViewContent` y `Search` necesitan datos que
 * solo conoce el servidor —qué producto, a qué precio, cuántos resultados— y las
 * páginas que los tienen son de servidor. Esto es la costura: recibe los datos ya
 * resueltos y los emite una vez.
 *
 * **Una vez** es la parte que importa. Sin el guardia, cualquier re-render
 * —cambiar de variante, abrir el carrito— vuelve a emitir el evento, y en Meta
 * eso son visitas a producto que nunca ocurrieron. Los informes de una campaña se
 * ensucian de una forma que después nadie sabe explicar.
 */
export function EventoDePagina({
  evento,
  eventId,
  datos,
}: {
  evento: 'ViewContent' | 'Search' | 'Purchase';
  eventId: string;
  datos: Record<string, unknown>;
}) {
  const yaEmitido = useRef<string | null>(null);

  useEffect(() => {
    // Comparado contra el `eventId` y no contra un booleano: al navegar de un
    // producto a otro el componente se reutiliza, y con un booleano el segundo
    // producto no se contaría nunca.
    if (yaEmitido.current === eventId) return;
    yaEmitido.current = eventId;

    trackPixelEvent(evento, eventId, datos);
  }, [evento, eventId, datos]);

  return null;
}
