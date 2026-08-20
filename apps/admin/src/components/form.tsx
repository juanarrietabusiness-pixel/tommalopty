'use client';

import { useFormStatus } from 'react-dom';
import type { ActionResult } from '@/lib/actions/result';

/** Botón que se deshabilita solo mientras la Server Action está en vuelo. */
export function SubmitButton({
  children = 'Guardar',
  className = 'btn btn-dark btn-sm',
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? 'Guardando…' : children}
    </button>
  );
}

/** Mensaje de resultado de la acción (éxito o error). */
export function FormFeedback({ state }: { state: ActionResult }) {
  if (state.status === 'idle' || !state.message) return null;

  return (
    <div className={`notice notice-${state.status === 'success' ? 'success' : 'error'}`}>
      {state.message}
    </div>
  );
}

/** Errores de validación de un campo concreto. */
export function FieldError({ state, field }: { state: ActionResult; field: string }) {
  const errors = state.fieldErrors?.[field];
  if (!errors?.length) return null;

  return <span className="field-error">{errors.join(' ')}</span>;
}
