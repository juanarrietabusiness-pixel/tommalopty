'use client';

import { useEffect, useRef } from 'react';
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

/**
 * Mensaje de resultado de la acción (éxito o error).
 *
 * Lleva `role` y foco porque sin ellos **el mensaje no existía** para quien usa
 * un lector de pantalla: se enviaba el formulario, fallaba, y el foco seguía en
 * el botón sin que nada lo anunciara. Los 26 formularios del panel pasan por
 * aquí, así que el arreglo va aquí y no en cada uno.
 *
 * Dos papeles distintos a propósito:
 *
 * - `alert` para el error, que interrumpe: hay algo que corregir antes de
 *   seguir, y enterarse tarde significa haber seguido rellenando en balde.
 * - `status` para el éxito, que espera turno: es una confirmación, y cortar la
 *   lectura de otra cosa para darla molesta más de lo que ayuda.
 *
 * El foco solo se mueve al fallar, y solo cuando el mensaje cambia. Moverlo
 * también al acertar sacaría a cualquiera del campo en el que está escribiendo.
 */
export function FormFeedback({ state }: { state: ActionResult }) {
  const ref = useRef<HTMLDivElement>(null);
  const anterior = useRef<string | null>(null);

  const esError = state.status === 'error';
  const mensaje = state.message ?? null;

  useEffect(() => {
    // Solo al aparecer un error nuevo. Sin la comparación, cualquier
    // re-renderizado del formulario volvería a robar el foco.
    if (esError && mensaje && mensaje !== anterior.current) {
      ref.current?.focus();
    }
    anterior.current = esError ? mensaje : null;
  }, [esError, mensaje]);

  if (state.status === 'idle' || !mensaje) return null;

  return (
    <div
      ref={ref}
      // `-1` y no `0`: se puede enfocar por código, pero no aparece en el
      // recorrido del tabulador, donde sería una parada sin nada que hacer.
      tabIndex={-1}
      role={esError ? 'alert' : 'status'}
      className={`notice notice-${esError ? 'error' : 'success'}`}
    >
      {mensaje}
    </div>
  );
}

/** El identificador del error de un campo, para poder apuntarlo desde el campo. */
export function idDeError(field: string): string {
  return `error-${field}`;
}

/**
 * Lo que hay que añadirle a un control para que su error sea suyo.
 *
 * Va como un puñado de props para esparcir —`{...propsDeCampo(state, 'slug')}`—
 * en vez de repetir dos expresiones en cada campo. Sin esto, el mensaje de
 * error se pinta al lado del campo pero no está atado a él: un lector de
 * pantalla enfoca el campo y no lee nada, porque no sabe que ese texto le
 * corresponde.
 */
export function propsDeCampo(state: ActionResult, field: string) {
  const hayError = Boolean(state.fieldErrors?.[field]?.length);

  return {
    'aria-invalid': hayError || undefined,
    'aria-describedby': hayError ? idDeError(field) : undefined,
  } as const;
}

/** Errores de validación de un campo concreto. */
export function FieldError({ state, field }: { state: ActionResult; field: string }) {
  const errors = state.fieldErrors?.[field];
  if (!errors?.length) return null;

  return (
    <span id={idDeError(field)} className="field-error">
      {errors.join(' ')}
    </span>
  );
}
