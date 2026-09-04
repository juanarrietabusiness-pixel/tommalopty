'use client';

import { useActionState } from 'react';
import { barrerHuerfanos } from '@/lib/actions/almacenamiento';
import { IDLE, type ActionResult } from '@/lib/actions/result';

/**
 * El botón que borra. Pide confirmación diciendo **cuántos** ficheros se lleva,
 * porque «¿seguro?» sin una cifra no es una pregunta que alguien pueda
 * responder con criterio.
 */
export function BarridoHuerfanos({
  cuantos,
  puedeBorrar,
}: {
  cuantos: number;
  puedeBorrar: boolean;
}) {
  const [estado, formAction, pendiente] = useActionState<ActionResult, FormData>(
    async () => barrerHuerfanos(),
    IDLE,
  );

  if (!puedeBorrar) {
    return (
      <p className="field-hint">
        Vaciar el almacenamiento es cosa de un superadministrador. Tu rol puede ver el informe, pero
        no borrar.
      </p>
    );
  }

  return (
    <form
      action={formAction}
      onSubmit={(evento) => {
        if (
          !window.confirm(
            `Se van a borrar ${cuantos} ficheros que ninguna fila referencia. No se puede deshacer. ¿Continuar?`,
          )
        ) {
          evento.preventDefault();
        }
      }}
    >
      {estado.status !== 'idle' ? (
        <div className={`notice notice-${estado.status === 'success' ? 'success' : 'error'}`}>
          {estado.message}
        </div>
      ) : null}

      <button type="submit" className="btn btn-dark" disabled={pendiente || cuantos === 0}>
        {pendiente ? 'Borrando…' : `Borrar ${cuantos} ficheros huérfanos`}
      </button>
    </form>
  );
}
