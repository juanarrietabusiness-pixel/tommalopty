import { findZoneForPoint, type Coordinates, type DeliveryZone } from './geo';
import { puedeRecibirEntregas, type EstadoMotorizado } from './motorizado';
import { distanciaKm } from './rutas';

/**
 * A quién conviene darle esta entrega.
 *
 * PROPONE, NO ASIGNA
 *
 * Devuelve candidatos ordenados **con el motivo de cada uno**, y no elige. Quien
 * despacha sabe cosas que esto no: que a fulano se le dañó la moto, que ese
 * barrio no lo agarra nadie después de las seis, que el cliente pidió el mismo
 * de la vez pasada. Una pantalla que asigna sola y sin explicarse es una
 * pantalla que se ignora a la tercera vez que se equivoca.
 *
 * Por eso salen todos los candidatos, incluso los saturados: saber **por qué**
 * no se propone a alguien vale tanto como la propuesta.
 *
 * LAS TRES SEÑALES, Y CÓMO SE COMPARAN
 *
 * El plan pide ordenar por zona, carga y cercanía. El problema de mezclar tres
 * cosas es que el peso de cada una acaba siendo un número mágico que nadie
 * recuerda haber elegido. Aquí:
 *
 *  - **La zona manda y no se negocia.** Quien cubre la zona va primero, siempre.
 *    Es una decisión de cobertura que alguien tomó dibujando un polígono, y la
 *    cercanía no debería poder tumbarla.
 *  - **La carga y la cercanía se comparan en kilómetros.** Cada entrega que ya
 *    lleva encima cuenta como `KM_POR_ENTREGA_PENDIENTE`, así que las dos hablan
 *    la misma unidad y el peso deja de ser mágico: es «prefiero mandar a alguien
 *    dos kilómetros más lejos antes que ponerle una cuarta entrega a quien ya
 *    lleva tres».
 *
 * DE DÓNDE SALE «CERCANÍA» SI TODAVÍA NO HAY POSICIÓN EN VIVO
 *
 * De las entregas que ya lleva encima. Un motorizado con tres paradas en San
 * Francisco es el candidato natural para la cuarta en San Francisco, esté donde
 * esté ahora mismo. Cuando exista la posición en vivo se podrá afinar, pero esto
 * ya sirve y no depende de que nadie tenga el GPS encendido.
 */

/**
 * Cuánto «cuesta» cada entrega que alguien ya lleva encima, en kilómetros.
 *
 * Dos kilómetros es una postura, no una medida: dice que repartir la carga
 * importa, pero no tanto como para mandar a alguien al otro lado de la ciudad.
 * Se discutirá con datos el día que los haya; mientras tanto está aquí arriba,
 * con nombre, en vez de escondido dentro de una fórmula.
 */
export const KM_POR_ENTREGA_PENDIENTE = 2;

/** Por encima de esto no se propone a nadie, aunque sea el más cercano. */
export const MAX_ENTREGAS_POR_MOTORIZADO = 12;

export interface MotorizadoDisponible {
  id: string;
  nombre: string;
  estado: EstadoMotorizado;
  /** Zonas que cubre. Vacío significa «ninguna», no «todas». */
  zoneIds: readonly string[];
  /** Los puntos de las entregas que ya lleva encima. */
  entregasPendientes: readonly Coordinates[];
}

export interface Candidato {
  motorizadoId: string;
  nombre: string;
  /** ¿Se le puede proponer? Los que no, salen igual con su motivo. */
  proponible: boolean;
  cubreLaZona: boolean;
  cargaActual: number;
  /** Kilómetros a su entrega más cercana, o `null` si va vacío. */
  kmAlGrupo: number | null;
  /** Lo que se compara. Menos es mejor. En kilómetros. */
  coste: number;
  motivo: string;
}

function costeDe(entrada: { kmAlGrupo: number | null; cargaActual: number }): number {
  // Quien va vacío no tiene grupo al que estar cerca, y eso no debe penalizarle:
  // es justo a quien conviene darle la primera entrega de un barrio nuevo. Se le
  // cuenta cero de distancia, así que compite solo por carga — que tiene cero.
  const km = entrada.kmAlGrupo ?? 0;
  return km + entrada.cargaActual * KM_POR_ENTREGA_PENDIENTE;
}

function motivoDe(candidato: Omit<Candidato, 'motivo'>): string {
  if (candidato.cargaActual >= MAX_ENTREGAS_POR_MOTORIZADO) {
    return `Ya lleva ${candidato.cargaActual} entregas: no se le asignan más.`;
  }

  if (!candidato.proponible) {
    return 'No está activo, así que no recibe entregas nuevas.';
  }

  const partes = [candidato.cubreLaZona ? 'Cubre la zona' : 'No cubre esta zona'];

  partes.push(
    candidato.kmAlGrupo === null
      ? 'va vacío'
      : `su entrega más cercana está a ${candidato.kmAlGrupo.toFixed(1)} km`,
  );

  if (candidato.cargaActual > 0) partes.push(`lleva ${candidato.cargaActual}`);

  return `${partes.join(' · ')}.`;
}

/**
 * Ordena a los motorizados por lo bien que les viene esta entrega.
 *
 * `destino` puede ser `null`: un envío sin punto en el mapa no se puede acercar
 * a nadie, así que la cercanía deja de contar y tampoco se puede saber su zona.
 * En la práctica queda el que menos lleve. Es poco, y es lo honesto: sin
 * coordenada no hay más información que dar.
 */
export function sugerirMotorizado(
  destino: Coordinates | null,
  motorizados: readonly MotorizadoDisponible[],
  zonas: readonly DeliveryZone[],
): Candidato[] {
  const zonaDelDestino = destino ? findZoneForPoint(destino, zonas) : null;

  const candidatos: Candidato[] = motorizados.map((motorizado) => {
    const cargaActual = motorizado.entregasPendientes.length;

    const kmAlGrupo =
      destino && cargaActual > 0
        ? Math.min(...motorizado.entregasPendientes.map((punto) => distanciaKm(destino, punto)))
        : null;

    const cubreLaZona = zonaDelDestino ? motorizado.zoneIds.includes(zonaDelDestino.id) : false;

    const proponible =
      puedeRecibirEntregas(motorizado.estado) && cargaActual < MAX_ENTREGAS_POR_MOTORIZADO;

    const base = {
      motorizadoId: motorizado.id,
      nombre: motorizado.nombre,
      proponible,
      cubreLaZona,
      cargaActual,
      kmAlGrupo,
      coste: costeDe({ kmAlGrupo, cargaActual }),
    };

    return { ...base, motivo: motivoDe(base) };
  });

  return candidatos.sort((a, b) => {
    // Los que no se pueden proponer, al final, pase lo que pase.
    if (a.proponible !== b.proponible) return a.proponible ? -1 : 1;
    // La zona manda sobre la distancia: es una decisión de cobertura.
    if (a.cubreLaZona !== b.cubreLaZona) return a.cubreLaZona ? -1 : 1;
    if (a.coste !== b.coste) return a.coste - b.coste;
    // Empate real: por nombre, para que el orden no baile entre recargas.
    return a.nombre.localeCompare(b.nombre, 'es');
  });
}

/** El que se propondría, o `null` si no hay ninguno al que se le pueda dar. */
export function mejorCandidato(candidatos: readonly Candidato[]): Candidato | null {
  return candidatos.find((candidato) => candidato.proponible) ?? null;
}
