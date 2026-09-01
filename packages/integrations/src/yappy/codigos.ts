/**
 * Los códigos de respuesta de Yappy, traducidos a algo accionable.
 *
 * El manual (§ «Códigos de Respuesta de Servicios de Integración») los lista con
 * el mensaje que devuelve la API, y tres de ellos dicen exactamente lo mismo:
 * «ha ocurrido un error en procesar los datos, contacte al administrador». Ese
 * texto no le sirve a nadie a las once de la noche, así que aquí cada código
 * lleva además **qué mirar primero**. Es la diferencia entre un incidente de
 * diez minutos y uno de dos horas.
 */

/** Éxito. Cualquier otro código significa que no se hizo lo que se pidió. */
export const YAPPY_OK = 'YP-0000';

/** Éxito, pero sin resultados. No es un error: es una consulta vacía. */
export const YAPPY_SIN_DATOS = 'YP-0001';

interface Diagnostico {
  /** Qué pasó, en una línea. */
  que: string;
  /** Qué mirar primero. */
  donde: string;
}

const DIAGNOSTICOS: Record<string, Diagnostico> = {
  [YAPPY_OK]: { que: 'Correcto.', donde: '' },
  [YAPPY_SIN_DATOS]: {
    que: 'La consulta se ejecutó pero no hay movimientos en ese rango.',
    donde: 'No es un fallo. Amplía las fechas o revisa el filtro de alias.',
  },
  'YP-0002': {
    que: 'Yappy no pudo procesar la petición.',
    donde: 'Suele ser el cuerpo de la petición. Compáralo con los ejemplos de la especificación.',
  },
  'YP-0006': {
    que: 'No se pudo abrir la sesión.',
    donde:
      'Casi siempre es el código: revisa que YAPPY_API_KEY y YAPPY_SECRET_KEY sean las vigentes ' +
      '—generar credenciales nuevas invalida las anteriores— y que la fecha del hash sea la de Panamá.',
  },
  'YP-0008': {
    que: 'Faltan cabeceras obligatorias.',
    donde: 'No se está enviando la API Key, la Secret Key o el token de sesión.',
  },
  'YP-0010': {
    que: 'Algún campo del cuerpo no tiene un valor admitido.',
    donde: 'Revisa los enumerados: el rol es DEBIT o CREDIT, y las fechas van en YYYY-MM-DD.',
  },
  'YP-0039': {
    que: 'Demasiados alias en la consulta.',
    donde: 'El máximo son 25 alias por petición.',
  },
  'YP-0040': {
    que: 'El límite de la consulta está fuera de rango.',
    donde: 'Baja el `limit` de la paginación.',
  },
  'YP-9999': {
    que: 'Yappy tardó demasiado en responder.',
    donde: 'Es temporal. Reintentar más tarde; si persiste, es del lado de Yappy.',
  },
};

/**
 * Un mensaje de error que dice qué mirar.
 *
 * Se incluye el código literal siempre: es lo que hay que citar al escribir a
 * `integracionesdev@yappy.com.pa`, y sin él la conversación empieza por
 * averiguarlo.
 */
export function explicarCodigo(codigo: string, descripcion?: string): string {
  const conocido = DIAGNOSTICOS[codigo];

  if (!conocido) {
    // Un código nuevo no debe perderse: se devuelve tal cual, con lo que dijo
    // Yappy, en vez de un «error desconocido» que borra la única pista.
    return `[${codigo}] ${descripcion ?? 'Yappy devolvió un código que esta integración no conoce.'}`;
  }

  return `[${codigo}] ${conocido.que}${conocido.donde ? ` ${conocido.donde}` : ''}`;
}

export function esExito(codigo: string): boolean {
  return codigo === YAPPY_OK || codigo === YAPPY_SIN_DATOS;
}
