import { descifrar, importarClaveMaestra } from './cifrado';

/**
 * De dónde sale el valor de una credencial.
 *
 * El orden importa y es deliberado: **primero la bóveda, después el entorno.**
 *
 * Si fuese al revés, una variable vieja que alguien dejó puesta en Cloudflare
 * ganaría a la que la dueña acaba de pegar en el panel, y el síntoma sería
 * «cambié la clave y no pasó nada» — media tarde de alguien buscando en el sitio
 * equivocado.
 *
 * Y hay una regla que no se puede saltar: `NEXT_PUBLIC_*` en el navegador viene
 * del paquete compilado, no de aquí. Esto sirve para leerlas **en servidor** y
 * pasarlas como props; ver `leerPublicas`.
 */

export interface CredencialGuardada {
  clave: string;
  valorCifrado: string;
}

export type Entorno = Readonly<Record<string, string | undefined>>;

export interface OpcionesDeResolucion {
  guardadas: readonly CredencialGuardada[];
  claveMaestra?: string;
  entorno?: Entorno;
}

/** Un valor de entorno vacío es lo mismo que no tenerlo. */
function desdeEntorno(entorno: Entorno, clave: string): string | undefined {
  const valor = entorno[clave];
  return valor && valor.trim() !== '' ? valor : undefined;
}

/**
 * Resuelve todas las credenciales de una vez.
 *
 * Devuelve un mapa y no una función que descifra a demanda porque descifrar es
 * asíncrono: una función síncrona obligaría a cachear por dentro, y una caché de
 * secretos es justo lo que no conviene tener por ahí sin que se vea.
 *
 * Si la clave maestra falta o no descifra, **cae al entorno y sigue**. Que la
 * tienda deje de cobrar porque alguien rotó mal una clave sería convertir un
 * problema de configuración en una caída.
 */
export async function resolverCredenciales({
  guardadas,
  claveMaestra,
  entorno = process.env,
}: OpcionesDeResolucion): Promise<Map<string, string>> {
  const resueltas = new Map<string, string>();

  if (claveMaestra && guardadas.length > 0) {
    try {
      const clave = await importarClaveMaestra(claveMaestra);

      for (const guardada of guardadas) {
        try {
          resueltas.set(guardada.clave, await descifrar(guardada.valorCifrado, clave));
        } catch {
          // Una credencial que no descifra no tumba a las demás: puede ser la
          // única rotada a mano, y las otras siguen siendo válidas.
          console.warn(`[credenciales] No se pudo descifrar ${guardada.clave}.`);
        }
      }
    } catch {
      console.warn('[credenciales] Clave maestra inválida: se usará solo el entorno.');
    }
  }

  for (const clave of Object.keys(entorno)) {
    if (resueltas.has(clave)) continue;
    const valor = desdeEntorno(entorno, clave);
    if (valor !== undefined) resueltas.set(clave, valor);
  }

  return resueltas;
}

/**
 * Qué claves tienen valor, sin descifrar ninguna.
 *
 * Es lo que necesita el panel para decir «configurada» o «faltan dos», y no
 * necesita más. Pintar esa pantalla nunca descifra un secreto, así que tampoco
 * puede filtrarlo.
 */
export function clavesConValor(
  guardadas: readonly { clave: string }[],
  claves: Iterable<string>,
  entorno: Entorno = process.env,
): Set<string> {
  const conValor = new Set(guardadas.map((g) => g.clave));

  for (const clave of claves) {
    if (desdeEntorno(entorno, clave) !== undefined) conValor.add(clave);
  }

  return conValor;
}
