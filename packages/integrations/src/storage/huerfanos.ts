/**
 * Qué objetos del bucket sobran, y cuáles no se tocan.
 *
 * Este módulo decide; no borra. Es puro a propósito, porque es la parte que
 * tiene que estar bien: un fallo aquí no deja basura, borra fotos de productos
 * que sí se usan.
 *
 * POR QUÉ HACE FALTA
 *
 * Hasta que se arregló, borrar una imagen quitaba su fila y dejaba el fichero.
 * Ese arreglo detiene la hemorragia, pero no recoge lo ya derramado: para eso
 * hay que comparar lo que hay en el bucket con lo que la base referencia.
 *
 * LAS DOS TRAMPAS QUE ESTO EVITA
 *
 * 1. **Una lista de referencias incompleta lo declara todo huérfano.** Si la
 *    consulta a la base falla a medias y devuelve cero claves, «lo que nadie
 *    referencia» es el bucket entero. Por eso `clasificar` no acepta una lista
 *    vacía sin más: quien llama tiene que afirmar que la enumeración fue
 *    completa, y si no lo fue, no se clasifica nada como huérfano.
 *
 * 2. **Una imagen recién subida todavía no tiene fila.** El panel sube primero
 *    y guarda el formulario después, así que entre las dos cosas el objeto está
 *    en el bucket sin que nada lo referencie — y es exactamente el fichero que
 *    alguien está a punto de usar. De ahí el margen de edad.
 */

/** Carpetas que este barrido puede tocar. El resto del bucket no es asunto suyo. */
const PREFIJOS_BARRIBLES = ['productos/', 'cms/'] as const;

export interface ObjetoAlmacenado {
  key: string;
  subidoEn: Date;
  bytes: number;
}

export interface Clasificacion {
  /** Sobran: nadie los referencia y ya son lo bastante viejos. */
  huerfanos: ObjetoAlmacenado[];
  /** Huérfanos por ahora, pero demasiado recientes para tocarlos. */
  recientes: ObjetoAlmacenado[];
  /** Referenciados por alguna fila. */
  enUso: ObjetoAlmacenado[];
  /** Fuera de las carpetas conocidas: ni se cuentan ni se tocan. */
  ajenos: ObjetoAlmacenado[];
  /** Suma de bytes de lo que se borraría. */
  bytesHuerfanos: number;
}

const VACIA: Clasificacion = {
  huerfanos: [],
  recientes: [],
  enUso: [],
  ajenos: [],
  bytesHuerfanos: 0,
};

export function esBarrible(key: string): boolean {
  return PREFIJOS_BARRIBLES.some((prefijo) => key.startsWith(prefijo));
}

/**
 * Reparte los objetos del bucket en las cuatro categorías.
 *
 * `enumeracionCompleta` no es un detalle: es la afirmación de quien llama de que
 * `clavesEnUso` contiene **todas** las referencias de la base. Si es `false`
 * —una consulta falló, una página no se leyó— no se declara nada huérfano y se
 * devuelve todo como «en uso», que es el lado seguro del error.
 */
export function clasificar(input: {
  objetos: readonly ObjetoAlmacenado[];
  clavesEnUso: ReadonlySet<string>;
  enumeracionCompleta: boolean;
  ahora: Date;
  margenHoras: number;
}): Clasificacion {
  if (!input.enumeracionCompleta) {
    return { ...VACIA, enUso: [...input.objetos] };
  }

  // Un margen no positivo dejaría sin protección a lo recién subido, así que no
  // se acepta: quien pida 0 horas recibe el mínimo, no la ausencia de guarda.
  const horas = Number.isFinite(input.margenHoras) ? Math.max(input.margenHoras, 1) : 1;
  const corte = new Date(input.ahora.getTime() - horas * 60 * 60 * 1000);

  const resultado: Clasificacion = {
    huerfanos: [],
    recientes: [],
    enUso: [],
    ajenos: [],
    bytesHuerfanos: 0,
  };

  for (const objeto of input.objetos) {
    if (!esBarrible(objeto.key)) {
      resultado.ajenos.push(objeto);
      continue;
    }

    if (input.clavesEnUso.has(objeto.key)) {
      resultado.enUso.push(objeto);
      continue;
    }

    // `>=` y no `>`: ante un empate exacto de fecha, se protege.
    if (objeto.subidoEn >= corte) {
      resultado.recientes.push(objeto);
      continue;
    }

    resultado.huerfanos.push(objeto);
    resultado.bytesHuerfanos += objeto.bytes;
  }

  return resultado;
}
