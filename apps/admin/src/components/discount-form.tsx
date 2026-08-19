'use client';

import { useActionState } from 'react';
import { createDiscount } from '@/lib/actions/catalog-extra';
import { IDLE } from '@/lib/actions/result';
import { FieldError, FormFeedback, SubmitButton } from './form';

export function DiscountForm() {
  const [state, formAction] = useActionState(createDiscount, IDLE);

  return (
    <form action={formAction} className="card">
      <div className="card-head">
        <h3>Nuevo descuento</h3>
      </div>

      <FormFeedback state={state} />

      <div className="field">
        <label htmlFor="code">Código</label>
        <input id="code" name="code" required placeholder="BIENVENIDA10" />
        <span className="field-hint">Se guarda en mayúsculas y no distingue mayúsculas al canjear.</span>
        <FieldError state={state} field="code" />
      </div>

      <div className="field">
        <label htmlFor="type">Tipo</label>
        <select id="type" name="type" defaultValue="percentage">
          <option value="percentage">Porcentaje</option>
          <option value="fixed_amount">Importe fijo (USD)</option>
          <option value="free_shipping">Envío gratis</option>
        </select>
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="value">Valor</label>
          <input id="value" name="value" type="number" step="0.01" min="0" defaultValue={10} />
          <FieldError state={state} field="value" />
        </div>
        <div className="field">
          <label htmlFor="minSubtotal">Subtotal mínimo</label>
          <input id="minSubtotal" name="minSubtotal" type="number" step="0.01" min="0" defaultValue={0} />
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="usageLimit">Límite de usos</label>
          <input id="usageLimit" name="usageLimit" type="number" min="1" placeholder="Sin límite" />
        </div>
        <div className="field">
          <label htmlFor="endsAt">Caduca el</label>
          <input id="endsAt" name="endsAt" type="date" />
        </div>
      </div>

      <div className="field">
        <label htmlFor="description">Descripción interna</label>
        <input id="description" name="description" />
      </div>

      <SubmitButton>Crear descuento</SubmitButton>
    </form>
  );
}
