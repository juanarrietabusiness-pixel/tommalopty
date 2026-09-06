#!/usr/bin/env node
/**
 * Toda función nueva de una migración declara quién puede ejecutarla.
 *
 * POR QUÉ EXISTE
 *
 * Tres veces en este repositorio una función nació pudiéndola llamar
 * cualquiera, y las tres veces el diff parecía correcto:
 *
 *   · issues #9 y #10 — funciones nuevas con `EXECUTE` para `PUBLIC`;
 *   · `limpiar_lead_intentos` — escrita sin `revoke` en la migración cuyo
 *     asunto era exactamente ese descuido.
 *
 * La causa es una regla de Postgres que no se ve leyendo SQL: **una función
 * nueva nace con `EXECUTE` concedido a `PUBLIC`**, y `revoke ... from anon,
 * authenticated` NO se lo quita, porque el permiso no está concedido a esos
 * roles sino a `PUBLIC`. Olvidar el `revoke` no produce ningún error: produce
 * una función pública.
 *
 * QUÉ COMPRUEBA, Y QUÉ NO
 *
 * Comprueba una cosa sola: que cada `create [or replace] function public.X`
 * que no devuelva `trigger` acabe teniendo una sentencia de privilegios que la
 * nombre. No juzga si los privilegios son los correctos —eso no se puede leer
 * de un texto— sino que alguien los pensó.
 *
 * El ámbito es **el conjunto de migraciones, no el fichero**, y en orden
 * cronológico: vale que los privilegios lleguen en una migración posterior.
 * Tiene que ser así porque una migración ya aplicada no se reescribe —
 * cambiarla no cambia ninguna base de datos, solo hace que el fichero mienta
 * sobre lo que pasó— así que el descuido de ayer se corrige con un fichero
 * nuevo. Lo que importa es el estado final, y eso es lo que se mide.
 *
 * La comprobación de si son los correctos vive en
 * `packages/db/src/__tests__/permisos.test.ts`, contra un Postgres real, y es
 * la que manda. Esta es la barata: corre en dos segundos, sin base de datos, y
 * dice lo que falta antes de levantar nada.
 *
 * Una función de disparador queda fuera porque no se llama, se dispara: no
 * tiene superficie por RPC.
 *
 * LA LISTA DE HEREDADAS
 *
 * Tres funciones anteriores a esta regla no la cumplen. Se listan abajo por
 * nombre y con su motivo, igual que `frozen_paths` en `google/adk-samples`, y
 * la lista solo puede encoger.
 *
 * USO
 *
 *   node tools/validar-migraciones.mjs
 *
 * Salidas: 0 todo declarado · 1 falta alguna · 2 error de uso.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIRECTORIO = 'supabase/migrations';

/**
 * Funciones anteriores a esta regla, con el motivo de cada una.
 *
 * Es por función y no por fichero a propósito: eximir un fichero entero exime
 * también lo que se le añada mañana. Estas tres son las únicas que quedan
 * después de que la migración 0021 (`endurecer_funciones`) hiciera su barrido
 * en masa; las otras ocho que había dejaron de hacer falta solas.
 *
 * La lista solo puede encoger. Añadir una entrada es declarar que una función
 * nueva puede llamarla cualquiera, y eso se decide mirando la base de datos —
 * `permisos.test.ts`— no este fichero.
 */
const HEREDADAS = new Map([
  [
    'slugify',
    'Función pura sobre su argumento, sin `security definer`: corre con los ' +
      'privilegios de quien la llama y no toca ninguna tabla.',
  ],
  [
    'build_product_search_vector',
    'Igual: pura, sin `security definer`. La usa el disparador de búsqueda del ' +
      'catálogo, y llamarla desde fuera solo devuelve un tsvector.',
  ],
  [
    'validate_discount',
    'La tienda comprueba un cupón antes del checkout, sin sesión, así que `anon` ' +
      'tiene que poder. La migración 0032 la reescribió con `create or replace`, ' +
      'que CONSERVA los privilegios que ya tenía, y por eso sigue funcionando sin ' +
      'declararlos. Que funcione por herencia en vez de por declaración es justo ' +
      'lo frágil; los privilegios reales están fijados en `permisos.test.ts`.',
  ],
]);

/**
 * Quita comentarios y literales para no confundir una mención con una
 * sentencia.
 *
 * Hace falta de verdad: la cabecera de una migración suele explicar el
 * problema citando el `revoke` que faltaba, y sin esto esa cita contaría como
 * el `revoke` que no está. El validador daría por buena justo la migración que
 * documenta el fallo.
 */
export function sinComentariosNiLiterales(sql) {
  return sql
    .replace(/\$([a-zA-Z_]*)\$[\s\S]*?\$\1\$/g, ' ') // cuerpos $$ … $$
    .replace(/--[^\n]*/g, ' ') // comentarios de línea
    .replace(/\/\*[\s\S]*?\*\//g, ' ') // comentarios de bloque
    .replace(/'(?:[^']|'')*'/g, "''"); // literales de texto
}

/** Las funciones no-disparador que crea una migración. */
export function funcionesCreadas(sqlLimpio) {
  const nombres = new Set();
  const patron =
    /\bcreate\s+(?:or\s+replace\s+)?function\s+(?:public\.)?([a-z_][a-z0-9_]*)\s*\(([\s\S]*?)\)\s*returns\s+([a-z_ ]*)/gi;

  for (const coincidencia of sqlLimpio.matchAll(patron)) {
    const [, nombre, , devuelve] = coincidencia;
    if (devuelve.trim().toLowerCase().startsWith('trigger')) continue;
    nombres.add(nombre.toLowerCase());
  }
  return nombres;
}

/** Las funciones que una migración nombra en un `grant` o un `revoke`. */
export function funcionesConPrivilegios(sqlLimpio) {
  const nombres = new Set();
  const patron =
    /\b(?:grant|revoke)\b[\s\S]{0,120}?\bon\s+function\s+(?:public\.)?([a-z_][a-z0-9_]*)/gi;

  for (const coincidencia of sqlLimpio.matchAll(patron)) {
    nombres.add(coincidencia[1].toLowerCase());
  }

  // NO se reconoce ningún barrido en masa como cobertura, y es deliberado.
  //
  // La primera versión sí lo hacía: la migración 0021 lleva un
  // `execute format('revoke all on function %s ...')` sobre una consulta al
  // catálogo, y parecía razonable darlo por bueno. Es falso. Ese barrido filtra
  // por `prorettype in ('trigger', 'event_trigger')`, así que no toca ninguna
  // función llamable — precisamente las únicas que este validador vigila.
  //
  // Un barrido cuyo alcance vive dentro de una consulta no se puede leer desde
  // fuera, y darlo por bueno es abrir el mismo agujero que esto viene a cerrar:
  // una función que nadie declaró, tapada por una sentencia que no la cubría.
  return nombres;
}

/**
 * Recorre las migraciones en orden y devuelve lo que quedó sin declarar.
 *
 * `ficheros` tiene que venir ordenado como se aplica, que es por nombre: el
 * sello de tiempo del principio lo garantiza.
 *
 * Se apunta dónde nació cada función que quedó pendiente, no dónde se detectó,
 * porque lo primero es lo que hay que ir a mirar.
 */
export function revisar(ficheros) {
  /** nombre de función → fichero donde se creó, mientras siga sin declarar. */
  const pendientes = new Map();

  for (const { nombre, sql } of ficheros) {
    const limpio = sinComentariosNiLiterales(sql);
    const declaradas = funcionesConPrivilegios(limpio);

    for (const funcion of declaradas) pendientes.delete(funcion);

    for (const funcion of funcionesCreadas(limpio)) {
      if (declaradas.has(funcion) || HEREDADAS.has(funcion)) continue;
      pendientes.set(funcion, nombre);
    }
  }

  const porFichero = new Map();
  for (const [funcion, fichero] of pendientes) {
    if (!porFichero.has(fichero)) porFichero.set(fichero, []);
    porFichero.get(fichero).push(funcion);
  }

  return [...porFichero.entries()]
    .map(([nombre, funciones]) => ({ nombre, funciones: funciones.sort() }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
}

function principal() {
  let entradas;
  try {
    entradas = readdirSync(DIRECTORIO)
      .filter((n) => n.endsWith('.sql'))
      .sort();
  } catch {
    console.error(`No encuentro ${DIRECTORIO}. Ejecuta esto desde la raíz del repositorio.`);
    process.exit(2);
  }

  const ficheros = entradas.map((nombre) => ({
    nombre,
    sql: readFileSync(join(DIRECTORIO, nombre), 'utf8'),
  }));

  const fallos = revisar(ficheros);

  if (fallos.length === 0) {
    console.log(
      `✔ ${entradas.length} migraciones revisadas: ` +
        `toda función nueva declara quién puede ejecutarla.`,
    );
    return;
  }

  console.error('✘ Funciones creadas sin declarar quién puede ejecutarlas.\n');
  console.error(
    'Una función nueva nace con EXECUTE para PUBLIC. Sin un `revoke ... from public`\n' +
      'la puede llamar cualquiera, aunque hayas revocado de `anon` y `authenticated`:\n' +
      'el permiso no está concedido a esos roles, sino a PUBLIC.\n',
  );

  for (const { nombre, funciones } of fallos) {
    console.error(`  ${nombre}`);
    for (const funcion of funciones) {
      console.error(`      public.${funcion}(…)  — falta un grant o un revoke que la nombre`);
    }
  }

  console.error(
    '\nLo que suele faltar, copiado de la migración 0035:\n\n' +
      '    revoke all on function public.LA_FUNCION(ARGS) from public;\n' +
      '    revoke all on function public.LA_FUNCION(ARGS) from anon, authenticated;\n' +
      '    grant execute on function public.LA_FUNCION(ARGS) to service_role;\n',
  );

  process.exit(1);
}

// Solo corre cuando se invoca directamente; importado, expone sus funciones.
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  principal();
}
