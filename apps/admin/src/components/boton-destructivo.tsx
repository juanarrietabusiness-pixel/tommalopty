'use client';

import { useState, useTransition, type ReactNode } from 'react';
import type { ActionResult } from '@/lib/actions/result';
import { FormFeedback } from './form';

/**
 * Un botón que borra algo que no se recupera, y que pregunta antes.
 *
 * LA REGLA, ESCRITA UNA VEZ EN VEZ DE RECORDADA SEIS
 *
 * **Se confirma lo irreversible; no se confirma lo que se deshace solo.**
 *
 * Antes de esto la confirmación estaba justo al revés de donde hacía falta:
 * borrar un abono y eliminar una zona preguntaban, y borrar una imagen —que
 * desde el PR #43 se lleva también el fichero de R2— disparaba al primer clic,
 * en una lista de miniaturas con los botones pegados unos a otros.
 *
 * Que la regla viva en un componente y no en un comentario es lo que hace que
 * el próximo botón destructivo nazca preguntando: no hay forma de escribir uno
 * sin pasar por aquí, y aquí el mensaje es obligatorio.
 *
 * Por eso `confirmacion` no tiene valor por defecto. Un «¿Seguro?» genérico es
 * una pregunta que nadie puede responder con criterio; el mensaje tiene que
 * decir **qué se pierde** y **que no vuelve**.
 */
export function BotonDestructivo({
  confirmacion,
  alConfirmar,
  children,
  etiqueta,
  disabled,
  className = 'btn btn-outline btn-sm',
}: {
  /** Qué se pierde y que no se recupera. Sale tal cual en el diálogo. */
  confirmacion: string;
  alConfirmar: () => Promise<ActionResult | void>;
  children: ReactNode;
  /**
   * Nombre accesible, para cuando el texto visible se repite.
   *
   * Una lista de imágenes tiene cinco botones que ponen «Borrar», y un lector
   * de pantalla los lee «Borrar, Borrar, Borrar» sin decir cuál es cuál.
   */
  etiqueta?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [state, setState] = useState<ActionResult>({ status: 'idle' });
  const [pendiente, startTransition] = useTransition();

  return (
    <>
      <button
        type="button"
        className={className}
        disabled={disabled || pendiente}
        aria-label={etiqueta}
        onClick={() => {
          if (!window.confirm(confirmacion)) return;

          startTransition(async () => {
            const resultado = await alConfirmar();
            // Una acción que no devuelve nada —porque revalida y ya— no tiene
            // resultado que enseñar, y forzar uno inventaría un mensaje.
            if (resultado) setState(resultado);
          });
        }}
      >
        {pendiente ? 'Borrando…' : children}
      </button>
      <FormFeedback state={state} />
    </>
  );
}
