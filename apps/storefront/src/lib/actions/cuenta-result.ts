/**
 * El resultado que las acciones de la cuenta devuelven a los formularios.
 *
 * VIVE APARTE POR UNA RAZÓN, NO POR ORDEN
 *
 * `cuenta.ts` lleva `'use server'`, y un fichero con esa directiva **solo puede
 * exportar funciones asíncronas**. `ACCOUNT_IDLE` es un objeto, así que al
 * exportarlo desde allí el módulo entero fallaba al evaluarse:
 *
 *   Error: A "use server" file can only export async functions, found object.
 *
 * Y como el error ocurre al cargar el módulo, no al llamar a la acción, el
 * síntoma no se parecía en nada a la causa: la pantalla se pintaba
 * perfectamente y **cada envío devolvía un 500**. Guardar los datos personales
 * en «Mis datos» nunca funcionó desde que se construyó esa pantalla; no había
 * ningún test que enviara el formulario, así que nada lo dijo.
 *
 * Los tipos podrían quedarse en `cuenta.ts` —se borran al compilar— pero se
 * traen aquí con la constante: si el tipo y su valor viven juntos, el próximo
 * que añada un `ACCOUNT_ALGO` lo pondrá donde no rompe.
 */

export interface AccountResult {
  status: 'idle' | 'success' | 'error';
  message?: string;
  fieldErrors?: Record<string, string[]>;
}

export const ACCOUNT_IDLE: AccountResult = { status: 'idle' };
