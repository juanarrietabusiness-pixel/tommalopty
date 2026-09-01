'use client';

import { useActionState, useState } from 'react';
import {
  POLITICAS_DE_DESPACHO,
  POLITICA_LABELS,
  type PoliticaDeDespacho,
  type ReglaDeDespacho,
} from '@nebula/domain';
import { guardarReglaDeDespacho } from '@/lib/actions/logistica';
import { IDLE } from '@/lib/actions/result';
import { FormFeedback, SubmitButton } from './form';

/**
 * Lo que decide si un pedido con saldo puede salir del almacén.
 *
 * Cada opción lleva escrito lo que arriesga, y no solo lo que hace. Es una
 * decisión de dinero: quien la toma tiene que poder ver la consecuencia sin
 * preguntarle a nadie.
 */
const CONSECUENCIAS: Record<PoliticaDeDespacho, string> = {
  estricta:
    'Nunca hay mercancía en la calle contra una promesa. A cambio, un pedido de ticket alto puede quedarse parado esperando el último abono.',
  umbral:
    'Permite mover pedidos grandes antes de cobrarlos del todo. Si el cliente desaparece, se pierde lo que falte por cobrar.',
  contra_entrega:
    'El pedido sale y quien entrega cobra el resto en la puerta. Es lo que más vende y lo que más expone: hace falta que quien entrega liquide bien.',
};

export function ReglaDespachoForm({
  regla,
  puedeEditar,
}: {
  regla: ReglaDeDespacho;
  puedeEditar: boolean;
}) {
  const [state, formAction] = useActionState(guardarReglaDeDespacho, IDLE);
  const [politica, setPolitica] = useState<PoliticaDeDespacho>(regla.politica);

  if (!puedeEditar) {
    return (
      <>
        <p style={{ margin: 0 }}>
          <strong>{POLITICA_LABELS[regla.politica]}</strong>
          {regla.politica === 'umbral' ? ` · ${regla.umbralPorcentaje} %` : ''}
        </p>
        <p className="field-hint">
          Solo un superadministrador puede cambiarla: es una decisión que puede costar dinero.
        </p>
      </>
    );
  }

  return (
    <form action={formAction}>
      <FormFeedback state={state} />

      <div className="regla-opciones">
        {POLITICAS_DE_DESPACHO.map((opcion) => (
          <label key={opcion} className="regla-opcion" data-elegida={opcion === politica}>
            <input
              type="radio"
              name="politica"
              value={opcion}
              checked={opcion === politica}
              onChange={() => setPolitica(opcion)}
            />
            <span>
              <strong>{POLITICA_LABELS[opcion]}</strong>
              {CONSECUENCIAS[opcion]}
            </span>
          </label>
        ))}
      </div>

      <div className="field" hidden={politica !== 'umbral'}>
        <label htmlFor="umbralPorcentaje">Porcentaje que hace falta para despachar</label>
        <input
          id="umbralPorcentaje"
          name="umbralPorcentaje"
          type="number"
          min="0"
          max="100"
          step="1"
          defaultValue={regla.umbralPorcentaje}
        />
        <span className="field-hint">
          Con 50, un pedido de $300 sale cuando se hayan cobrado $150.
        </span>
      </div>

      <SubmitButton>Guardar la regla</SubmitButton>
    </form>
  );
}
