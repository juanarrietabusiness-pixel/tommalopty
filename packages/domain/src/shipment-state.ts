/**
 * Máquina de estados de un envío.
 *
 * Existe por lo mismo que la de pedidos: sin ella, cualquier pantalla puede
 * mover un envío a donde le parezca. Y aquí importa más, porque quien va a
 * mover estos estados no es una persona sentada en un panel: es alguien en la
 * calle, con una mano en el manillar, tocando un botón en el teléfono. Los
 * toques accidentales existen, y un envío que vuelve de «entregado» a «en ruta»
 * deja al cliente mirando una mentira.
 *
 * Un pedido y un envío son cosas distintas y por eso son máquinas distintas: un
 * pedido puede tener varios envíos —despacho parcial, o dos viajes— y cada uno
 * va por su cuenta.
 */

export const SHIPMENT_STATUSES = [
  'pendiente',
  'asignado',
  'recogido',
  'en_ruta',
  'entregado',
  'fallido',
  'devuelto',
] as const;

export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number];

export function isShipmentStatus(value: string): value is ShipmentStatus {
  return (SHIPMENT_STATUSES as readonly string[]).includes(value);
}

/**
 * Qué se lee en pantalla. Se escriben desde el punto de vista de quien mira, no
 * del sistema: el cliente entiende «va en camino», no «en_ruta».
 */
export const SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, string> = {
  pendiente: 'Pendiente de asignar',
  asignado: 'Asignado',
  recogido: 'Recogido',
  en_ruta: 'En camino',
  entregado: 'Entregado',
  fallido: 'Entrega fallida',
  devuelto: 'Devuelto',
};

const TRANSITIONS: Record<ShipmentStatus, readonly ShipmentStatus[]> = {
  pendiente: ['asignado', 'fallido'],
  asignado: ['recogido', 'pendiente', 'fallido'],
  recogido: ['en_ruta', 'fallido'],
  en_ruta: ['entregado', 'fallido'],
  // Un intento fallido se reintenta —vuelve a la cola— o se devuelve. No pasa
  // a «entregado» directamente: si al final se entregó, hubo un segundo intento
  // y ese intento merece constar.
  fallido: ['pendiente', 'devuelto'],
  // Terminales.
  entregado: [],
  devuelto: [],
};

export function canTransitionShipment(from: ShipmentStatus, to: ShipmentStatus): boolean {
  if (from === to) return true;
  return TRANSITIONS[from].includes(to);
}

export function allowedShipmentTransitions(from: ShipmentStatus): readonly ShipmentStatus[] {
  return TRANSITIONS[from];
}

export function isTerminalShipmentStatus(status: ShipmentStatus): boolean {
  return TRANSITIONS[status].length === 0;
}

/**
 * ¿Es un estado en el que el envío ya salió del almacén?
 *
 * Lo usa el panel para no dejar editar la dirección de un envío que ya va por
 * la calle: cambiarla ahí no cambia dónde está yendo quien la lleva, solo hace
 * que el sistema y la realidad dejen de coincidir.
 */
export function estaEnLaCalle(status: ShipmentStatus): boolean {
  return status === 'recogido' || status === 'en_ruta';
}

/**
 * Los dos únicos estados que puede marcar quien entrega, desde la calle.
 *
 * El resto —asignar, devolver— son decisiones de quien despacha, y se toman
 * desde el panel. La página del motorizado no los ofrece.
 */
export const ESTADOS_DESDE_LA_CALLE = [
  'entregado',
  'fallido',
] as const satisfies readonly ShipmentStatus[];

/**
 * Lo que puede marcar un motorizado identificado, desde su aplicación.
 *
 * Son más que los de arriba, y la diferencia no es de comodidad sino de quién
 * está al otro lado. `ESTADOS_DESDE_LA_CALLE` los marca **cualquiera que tenga
 * el papel en la mano**: el QR no pide sesión, y con razón —quien recibe puede
 * no ser quien lleva—. Esta lista la marca alguien con cuenta, con nombre y con
 * una ficha de motorizado detrás, así que también puede decir que recogió el
 * paquete y que va en camino.
 *
 * Lo que sigue fuera para los dos: asignar y devolver. Son decisiones de quien
 * despacha, y se toman desde el panel.
 *
 * **Esta lista está repetida en `guard_courier_shipment_update`** (migración
 * 0031). La de aquí es para que la pantalla no ofrezca lo que no puede; la de
 * allí es la que de verdad no se puede saltar. Si se toca una, se toca la otra.
 */
export const ESTADOS_DEL_MOTORIZADO = [
  'recogido',
  'en_ruta',
  'entregado',
  'fallido',
] as const satisfies readonly ShipmentStatus[];

export function esEstadoDelMotorizado(value: string): boolean {
  return (ESTADOS_DEL_MOTORIZADO as readonly string[]).includes(value);
}

export interface ShipmentTransitionError {
  from: ShipmentStatus;
  to: ShipmentStatus;
  message: string;
}

/** Valida un cambio de estado antes de tocar la base de datos. */
export function validateShipmentTransition(
  from: ShipmentStatus,
  to: ShipmentStatus,
): ShipmentTransitionError | null {
  if (canTransitionShipment(from, to)) return null;

  return {
    from,
    to,
    message: `Un envío "${SHIPMENT_STATUS_LABELS[from]}" no puede pasar a "${SHIPMENT_STATUS_LABELS[to]}".`,
  };
}
