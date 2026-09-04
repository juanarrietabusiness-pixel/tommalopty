'use client';

import { useLinkStatus } from 'next/link';
import type { ReactNode } from 'react';

/**
 * El contenido de un enlace del menú, que además dice cuándo está trabajando.
 *
 * POR QUÉ NO BASTABA `loading.tsx`
 *
 * Se añadió un `loading.tsx` al panel esperando que apareciera al pulsar un
 * enlace, y **no aparece nunca en una navegación de cliente**. Se comprobó: el
 * esqueleto llega en la carga útil de Next, pero no entra en el DOM. El motivo
 * es que el enrutador navega dentro de una transición de React, y en una
 * transición React mantiene a la vista el contenido anterior en vez de
 * sustituirlo por el respaldo del `Suspense`. El `loading.tsx` sigue sirviendo
 * para la primera carga de una pantalla, que es otra cosa.
 *
 * Así que el aviso tiene que estar donde la transición sí lo deja: dentro del
 * propio enlace. `useLinkStatus` da exactamente eso —si la navegación que
 * arrancó ESTE enlace sigue en vuelo— y solo funciona desde un componente que
 * viva por debajo de un `<Link>`, que es la razón de que este fichero exista en
 * vez de meterlo en `admin-sidebar.tsx`.
 *
 * El problema que resuelve, dicho como se sentía: pulsar una sección y que no
 * pase nada visible hasta que responde el servidor, así que se vuelve a pulsar.
 */
export function NavLinkContent({ icon, label }: { icon?: ReactNode; label: string }) {
  const { pending } = useLinkStatus();

  return (
    <>
      {icon}
      {label}
      {pending ? (
        <span className="admin-nav-cargando" role="status">
          <span className="visually-hidden">Cargando {label}</span>
        </span>
      ) : null}
    </>
  );
}
