'use client';

import { barrerHuerfanos } from '@/lib/actions/almacenamiento';
import { BotonDestructivo } from './boton-destructivo';

/**
 * El botón que borra. Pide confirmación diciendo **cuántos** ficheros se lleva,
 * porque «¿seguro?» sin una cifra no es una pregunta que alguien pueda
 * responder con criterio.
 *
 * Pasa por `BotonDestructivo` como el resto: además de la confirmación, eso le
 * da el `role="alert"` del aviso, que pintándolo a mano se había quedado sin
 * él —era el único borrado del panel cuyo resultado no se anunciaba.
 */
export function BarridoHuerfanos({
  cuantos,
  puedeBorrar,
}: {
  cuantos: number;
  puedeBorrar: boolean;
}) {
  if (!puedeBorrar) {
    return (
      <p className="field-hint">
        Vaciar el almacenamiento es cosa de un superadministrador. Tu rol puede ver el informe, pero
        no borrar.
      </p>
    );
  }

  return (
    <BotonDestructivo
      className="btn btn-dark"
      disabled={cuantos === 0}
      confirmacion={`Se van a borrar ${cuantos} ficheros que ninguna fila referencia. No se puede deshacer. ¿Continuar?`}
      alConfirmar={() => barrerHuerfanos()}
    >
      {`Borrar ${cuantos} ficheros huérfanos`}
    </BotonDestructivo>
  );
}
