import { z } from 'zod';

/** Estado devuelto por las Server Actions a los formularios (useActionState). */
export interface ActionResult {
  status: 'idle' | 'success' | 'error';
  message?: string;
  fieldErrors?: Record<string, string[]>;
}

export const IDLE: ActionResult = { status: 'idle' };

export function success(message: string): ActionResult {
  return { status: 'success', message };
}

export function failure(message: string, fieldErrors?: Record<string, string[]>): ActionResult {
  return { status: 'error', message, fieldErrors };
}

/** Traduce un ZodError al formato de errores por campo del formulario. */
export function fromZodError(error: z.ZodError): ActionResult {
  const fieldErrors: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    fieldErrors[key] = [...(fieldErrors[key] ?? []), issue.message];
  }

  return failure('Revisa los campos marcados.', fieldErrors);
}

/**
 * Convierte un error de Postgres en un mensaje entendible.
 * El 42501 aparece cuando RLS rechaza la operación: es la señal de que el rol
 * no tiene permiso, no un fallo de la interfaz.
 */
export function fromDatabaseError(error: { code?: string; message: string }): ActionResult {
  switch (error.code) {
    case '23505':
      return failure('Ya existe un registro con ese identificador (slug, código o SKU).');
    case '23503':
      return failure('No se puede completar: hay registros relacionados que lo impiden.');
    case '42501':
      return failure('Tu rol no tiene permisos para esta operación.');
    default:
      return failure(`No se pudo guardar: ${error.message}`);
  }
}
