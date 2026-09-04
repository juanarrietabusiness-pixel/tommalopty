'use client';

import { useState, useTransition } from 'react';
import { archiveProduct } from '@/lib/actions/products';
import type { ActionResult } from '@/lib/actions/result';
import { FormFeedback } from './form';

/**
 * Archivar un producto de un clic.
 *
 * Se podía archivar antes de esto, cambiando «Estado» en el formulario de
 * edición y guardando. Pero la descripción del listado promete el archivado
 * como si fuera una acción («Los productos archivados dejan de verse en la
 * tienda…»), y el botón de borrar la única variante manda explícitamente a
 * archivar el producto. Las dos frases apuntaban a un desplegable escondido
 * en mitad de un formulario largo.
 *
 * Solo aparece si el producto no está ya archivado. Para desarchivar sigue
 * estando el desplegable de arriba, que es donde se elige entre borrador y
 * activo: aquí un botón «Desarchivar» tendría que decidir a cuál de los dos
 * vuelve, y esa no es una decisión que deba tomar un botón.
 */
export function ArchivarProducto({ productId, titulo }: { productId: string; titulo: string }) {
  const [state, setState] = useState<ActionResult>({ status: 'idle' });
  const [pendiente, startTransition] = useTransition();

  return (
    <>
      <button
        type="button"
        className="btn btn-outline btn-sm"
        disabled={pendiente}
        onClick={() => {
          if (
            !window.confirm(
              `¿Archivar «${titulo}»? Deja de verse en la tienda. Sus pedidos se conservan, y se puede volver a publicar desde el desplegable de Estado.`,
            )
          ) {
            return;
          }

          startTransition(async () => {
            setState(await archiveProduct(productId));
          });
        }}
      >
        {pendiente ? 'Archivando…' : 'Archivar'}
      </button>
      <FormFeedback state={state} />
    </>
  );
}
