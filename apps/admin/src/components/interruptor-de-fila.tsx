'use client';

import { useState, useTransition } from 'react';
import type { ActionResult } from '@/lib/actions/result';
import { FormFeedback } from './form';

/**
 * Un interruptor de activo/inactivo dentro de una fila de tabla.
 *
 * Existe porque dos pantallas —categorías y descuentos— enseñaban una columna
 * «Estado» que nadie podía cambiar: el formulario de al lado solo crea, y no
 * había ninguna otra vía. La columna solo podía decir «Activo», para siempre.
 *
 * No es un `<form>` con `useActionState` como el resto del panel: la acción
 * actúa sobre una fila concreta y se dispara sola, sin un «Guardar» que agrupe
 * varias. Por eso el resultado se lleva a mano, igual que en `ProductImages`.
 *
 * No pide confirmación a propósito: activar y desactivar es reversible con el
 * mismo botón. La regla del panel es confirmar lo irreversible, no lo que se
 * deshace pulsando otra vez.
 */
export function InterruptorDeFila({
  activo,
  alCambiar,
  nombre,
}: {
  activo: boolean;
  /** Recibe el estado al que se quiere ir, no el actual. */
  alCambiar: (activar: boolean) => Promise<ActionResult>;
  /** Cómo se llama la fila, para que el botón tenga nombre accesible propio. */
  nombre: string;
}) {
  const [state, setState] = useState<ActionResult>({ status: 'idle' });
  const [pendiente, startTransition] = useTransition();

  return (
    <>
      <button
        type="button"
        className="btn btn-outline btn-sm"
        disabled={pendiente}
        aria-label={`${activo ? 'Desactivar' : 'Activar'} ${nombre}`}
        onClick={() =>
          startTransition(async () => {
            setState(await alCambiar(!activo));
          })
        }
      >
        {pendiente ? '…' : activo ? 'Desactivar' : 'Activar'}
      </button>
      <FormFeedback state={state} />
    </>
  );
}
