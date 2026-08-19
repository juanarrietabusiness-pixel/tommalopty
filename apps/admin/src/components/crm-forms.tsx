'use client';

import { useActionState } from 'react';
import { addCustomerNote, updateCustomerTags } from '@/lib/actions/crm';
import { IDLE } from '@/lib/actions/result';
import { FormFeedback, SubmitButton } from './form';

export function CustomerNoteForm({ customerId }: { customerId: string }) {
  const [state, formAction] = useActionState(addCustomerNote, IDLE);

  return (
    <form action={formAction}>
      <input type="hidden" name="customerId" value={customerId} />
      <FormFeedback state={state} />

      <div className="field">
        <label htmlFor="body">Nueva nota</label>
        <textarea id="body" name="body" placeholder="Solo la ve el equipo" required />
      </div>

      <label
        style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.82rem', marginBottom: 14 }}
      >
        <input type="checkbox" name="isPinned" />
        Fijar arriba
      </label>

      <SubmitButton className="btn btn-outline btn-sm">Guardar nota</SubmitButton>
    </form>
  );
}

export function CustomerTagsForm({ customerId, tags }: { customerId: string; tags: string[] }) {
  const [state, formAction] = useActionState(updateCustomerTags, IDLE);

  return (
    <form action={formAction}>
      <input type="hidden" name="customerId" value={customerId} />
      <FormFeedback state={state} />

      <div className="field">
        <label htmlFor="tags">Etiquetas</label>
        <input id="tags" name="tags" defaultValue={tags.join(', ')} placeholder="VIP, Mayorista" />
        <span className="field-hint">Separadas por comas. Sirven para segmentar campañas.</span>
      </div>

      <SubmitButton className="btn btn-outline btn-sm">Guardar etiquetas</SubmitButton>
    </form>
  );
}
