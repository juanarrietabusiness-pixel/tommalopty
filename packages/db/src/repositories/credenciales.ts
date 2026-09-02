import { createClient } from '@supabase/supabase-js';
import { getPublicSupabaseConfig, getServiceRoleKey } from '../env';

/**
 * Acceso a la bóveda de credenciales.
 *
 * Esta tabla es la única del proyecto que **no tiene ninguna política RLS**, y
 * por eso no se alcanza con el cliente de sesión ni siquiera siendo
 * superadministrador. Todo lo de aquí usa service-role, que salta RLS y solo
 * existe en servidor.
 *
 * Por qué los tipos van escritos a mano y no salen de `database.types.ts`: ese
 * fichero se genera por introspección de un Supabase con las migraciones ya
 * aplicadas, y la de esta tabla todavía no lo está — aplicarla necesita accesos
 * que no tiene quien la escribió. En cuanto alguien ejecute `pnpm db:types`
 * después de aplicarla, estos tipos se pueden borrar y tirar de los generados.
 * Está anotado en `docs/CONECTAR.md`.
 */

export interface CredencialCifrada {
  clave: string;
  proveedor: string;
  valorCifrado: string;
  esSecreto: boolean;
  /** Lo que se le enseña a quien administra: `••••4821`, o el valor si no es secreto. */
  pista: string;
  actualizadoEn: string;
}

interface FilaCredencial {
  clave: string;
  proveedor: string;
  valor_cifrado: string;
  es_secreto: boolean;
  pista: string;
  actualizado_en: string;
}

const TABLA = 'integration_credentials';

/**
 * Cliente sin tipar contra `Database` a propósito.
 *
 * El cliente tipado conoce las tablas del esquema generado, y esta todavía no
 * está ahí. Escribir el nombre a mano con un cast en cada consulta ensuciaría
 * cada llamada; hacerlo una vez, aquí, deja el resto legible y marca con
 * claridad dónde está la costura.
 */
function clienteDeBoveda() {
  const { url } = getPublicSupabaseConfig();

  return createClient(url, getServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

function desdeFila(fila: FilaCredencial): CredencialCifrada {
  return {
    clave: fila.clave,
    proveedor: fila.proveedor,
    valorCifrado: fila.valor_cifrado,
    esSecreto: fila.es_secreto,
    pista: fila.pista,
    actualizadoEn: fila.actualizado_en,
  };
}

/**
 * Lee todas las credenciales guardadas.
 *
 * Si la tabla todavía no existe —la migración no está aplicada— devuelve lista
 * vacía en vez de lanzar. Eso hace que el panel se pueda abrir igual y que todo
 * siga funcionando con variables de entorno: la bóveda es una mejora, no un
 * requisito nuevo para arrancar.
 */
export async function listCredenciales(): Promise<CredencialCifrada[]> {
  const { data, error } = await clienteDeBoveda().from(TABLA).select('*').order('clave');

  if (error) {
    console.warn(`[credenciales] No se pudo leer la bóveda: ${error.message}`);
    return [];
  }

  return ((data ?? []) as FilaCredencial[]).map(desdeFila);
}

export interface CredencialAGuardar {
  clave: string;
  proveedor: string;
  valorCifrado: string;
  esSecreto: boolean;
  pista: string;
}

/** Guarda o reemplaza credenciales. La clave es única, así que reescribir es actualizar. */
export async function upsertCredenciales(
  credenciales: readonly CredencialAGuardar[],
  actualizadoPor: string | null,
): Promise<{ error: string | null }> {
  if (credenciales.length === 0) return { error: null };

  const { error } = await clienteDeBoveda()
    .from(TABLA)
    .upsert(
      credenciales.map((c) => ({
        clave: c.clave,
        proveedor: c.proveedor,
        valor_cifrado: c.valorCifrado,
        es_secreto: c.esSecreto,
        pista: c.pista,
        actualizado_por: actualizadoPor,
        actualizado_en: new Date().toISOString(),
      })),
      { onConflict: 'clave' },
    );

  return { error: error?.message ?? null };
}

/** Borra una credencial. Volver a dejarla en blanco es la forma de revocarla. */
export async function deleteCredencial(clave: string): Promise<{ error: string | null }> {
  const { error } = await clienteDeBoveda().from(TABLA).delete().eq('clave', clave);
  return { error: error?.message ?? null };
}
