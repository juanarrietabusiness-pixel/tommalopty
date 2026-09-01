'use client';

import { useActionState } from 'react';
import { money } from '@nebula/ui';
import { POLITICA_LABELS, decidirDespacho, type ReglaDeDespacho } from '@nebula/domain';
import { storage } from '@nebula/integrations';
import { borrarAbono, registrarAbono } from '@/lib/actions/abonos';
import { IDLE } from '@/lib/actions/result';
import { FieldError, FormFeedback, SubmitButton } from './form';

const METODOS: { valor: string; etiqueta: string }[] = [
  { valor: 'manual', etiqueta: 'Efectivo o transferencia' },
  { valor: 'yappy', etiqueta: 'Yappy' },
  { valor: 'paguelofacil', etiqueta: 'PagueloFácil' },
  { valor: 'wompi', etiqueta: 'Wompi' },
  { valor: 'paypal', etiqueta: 'PayPal' },
];

/**
 * El bloque de abonos de la ficha del pedido.
 *
 * Enseña el saldo antes que el formulario: quien va a registrar un abono
 * necesita saber cuánto falta antes de teclear una cifra, no después.
 */
export function AbonosForm({
  orderId,
  total,
  pagado,
  regla,
}: {
  orderId: string;
  total: number;
  pagado: number;
  regla: ReglaDeDespacho;
}) {
  const [state, formAction] = useActionState(registrarAbono, IDLE);
  const decision = decidirDespacho({ total, pagado, regla });
  const saldo = Math.max(total - pagado, 0);

  return (
    <div>
      <div className="abono-resumen">
        <div>
          <span>Total</span>
          <strong>{money(total)}</strong>
        </div>
        <div>
          <span>Abonado</span>
          <strong>{money(pagado)}</strong>
        </div>
        <div data-saldo={saldo > 0}>
          <span>Saldo</span>
          <strong>{money(saldo)}</strong>
        </div>
      </div>

      {/*
        El estado de despacho va aquí y no en el bloque de envíos porque es
        consecuencia del dinero: quien mira el saldo es quien necesita saber si
        eso ya deja salir el pedido.
      */}
      <div className={decision.puede ? 'notice notice-success' : 'notice notice-info'}>
        {decision.puede ? 'Se puede despachar. ' : 'Todavía no se puede despachar. '}
        {decision.motivo}
        <br />
        <span className="field-hint">Regla activa: {POLITICA_LABELS[regla.politica]}.</span>
      </div>

      <form action={formAction}>
        <input type="hidden" name="orderId" value={orderId} />

        <FormFeedback state={state} />

        <div className="field-row">
          <div className="field">
            <label htmlFor="amount">Cuánto se abonó</label>
            <input
              id="amount"
              name="amount"
              type="number"
              min="0.01"
              step="0.01"
              required
              placeholder={saldo > 0 ? saldo.toFixed(2) : '0.00'}
            />
            <FieldError state={state} field="amount" />
          </div>

          <div className="field">
            <label htmlFor="provider">Cómo pagó</label>
            <select id="provider" name="provider" defaultValue="manual">
              {METODOS.map((metodo) => (
                <option key={metodo.valor} value={metodo.valor}>
                  {metodo.etiqueta}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="field">
          <label htmlFor="reference">Referencia (opcional)</label>
          <input
            id="reference"
            name="reference"
            maxLength={120}
            placeholder="Número de transferencia, comprobante o quien lo recibió"
          />
        </div>

        {/*
          El comprobante va a un bucket privado y su enlace solo lo abre el
          equipo: suele ser la captura de una transferencia, con nombres y
          saldos. Si falla la subida, el abono se registra igual —el dinero
          entró, y eso es el hecho— y el aviso lo dice.
        */}
        <div className="field">
          <label htmlFor="comprobante">Comprobante (opcional)</label>
          <input
            id="comprobante"
            name="comprobante"
            type="file"
            accept={storage.MEDIA_ACCEPT_ATTRIBUTE}
          />
          <span className="field-hint">
            Solo lo ve el equipo: se guarda aparte de las imágenes de la tienda y no tiene enlace
            público.
          </span>
        </div>

        <SubmitButton>Registrar abono</SubmitButton>
      </form>
    </div>
  );
}

export function BorrarAbonoButton({ paymentId, orderId }: { paymentId: string; orderId: string }) {
  return (
    <form
      action={async () => {
        await borrarAbono(paymentId, orderId);
      }}
      onSubmit={(evento) => {
        if (!window.confirm('¿Borrar este abono? El saldo se recalculará.')) {
          evento.preventDefault();
        }
      }}
    >
      <button type="submit" className="btn btn-outline btn-sm">
        Borrar
      </button>
    </form>
  );
}
