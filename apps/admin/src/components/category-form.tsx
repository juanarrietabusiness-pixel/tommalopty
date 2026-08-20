'use client';

import { useActionState } from 'react';
import { slugify } from '@nebula/ui';
import { createCategory } from '@/lib/actions/catalog-extra';
import { IDLE } from '@/lib/actions/result';
import { FieldError, FormFeedback, SubmitButton } from './form';

export function CategoryForm() {
  const [state, formAction] = useActionState(createCategory, IDLE);

  return (
    <form action={formAction} className="card">
      <div className="card-head">
        <h3>Nueva categoría</h3>
      </div>

      <FormFeedback state={state} />

      <div className="field">
        <label htmlFor="name">Nombre</label>
        <input
          id="name"
          name="name"
          required
          onBlur={(event) => {
            const slugInput = event.currentTarget.form?.elements.namedItem(
              'slug',
            ) as HTMLInputElement | null;
            if (slugInput && !slugInput.value) slugInput.value = slugify(event.currentTarget.value);
          }}
        />
        <FieldError state={state} field="name" />
      </div>

      <div className="field">
        <label htmlFor="slug">Slug</label>
        <input id="slug" name="slug" required />
        <FieldError state={state} field="slug" />
      </div>

      <div className="field">
        <label htmlFor="description">Descripción</label>
        <textarea id="description" name="description" />
      </div>

      <div className="field">
        <label htmlFor="position">Orden</label>
        <input id="position" name="position" type="number" min="0" defaultValue={0} />
      </div>

      <SubmitButton>Crear categoría</SubmitButton>
    </form>
  );
}
