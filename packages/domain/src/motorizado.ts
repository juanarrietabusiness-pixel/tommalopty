/**
 * Los motorizados: sus estados y lo que significan.
 *
 * Fase L4 del plan de logística. Es puro y va aparte de `geo.ts` porque decidir
 * si a alguien se le puede asignar una entrega es una regla de negocio, no una
 * de geometría.
 */

/**
 * Las tres situaciones en las que puede estar quien reparte.
 *
 * `pausa` existe porque la alternativa —dar de baja y volver a dar de alta— pierde
 * el historial de la persona, y porque alguien de vacaciones o con la moto en el
 * taller sigue siendo del equipo. La diferencia con `inactivo` no es de grado:
 * quien está en pausa **entra a la aplicación y cierra lo que ya lleva encima**,
 * y quien está inactivo no entra. Pausar a alguien a media tarde no puede
 * dejarle tres paquetes sin poder marcar.
 */
export const ESTADOS_MOTORIZADO = ['activo', 'pausa', 'inactivo'] as const;

export type EstadoMotorizado = (typeof ESTADOS_MOTORIZADO)[number];

export function isEstadoMotorizado(value: string): value is EstadoMotorizado {
  return (ESTADOS_MOTORIZADO as readonly string[]).includes(value);
}

export const ESTADO_MOTORIZADO_LABELS: Record<EstadoMotorizado, string> = {
  activo: 'Activo',
  pausa: 'En pausa',
  inactivo: 'Inactivo',
};

export const ESTADO_MOTORIZADO_AYUDA: Record<EstadoMotorizado, string> = {
  activo: 'Se le pueden asignar entregas.',
  pausa: 'No recibe entregas nuevas, pero cierra las que ya lleva.',
  inactivo: 'No entra a la aplicación.',
};

export const VEHICULOS = ['moto', 'auto', 'bicicleta', 'a_pie'] as const;

export type Vehiculo = (typeof VEHICULOS)[number];

export function isVehiculo(value: string): value is Vehiculo {
  return (VEHICULOS as readonly string[]).includes(value);
}

export const VEHICULO_LABELS: Record<Vehiculo, string> = {
  moto: 'Moto',
  auto: 'Auto',
  bicicleta: 'Bicicleta',
  a_pie: 'A pie',
};

/** ¿Se le puede asignar una entrega nueva? */
export function puedeRecibirEntregas(estado: EstadoMotorizado): boolean {
  return estado === 'activo';
}

/** ¿Puede entrar a la aplicación y cerrar lo que lleva? */
export function puedeEntrar(estado: EstadoMotorizado): boolean {
  return estado !== 'inactivo';
}

export interface DocumentoDelMotorizado {
  tipo: string;
  numero?: string;
  /** `YYYY-MM-DD`. */
  vence?: string;
}

/**
 * Los papeles que están vencidos o a punto, a día de hoy.
 *
 * Avisa con treinta días porque renovar una licencia en Panamá no se hace en
 * una tarde, y un motorizado con la licencia vencida es un problema del negocio
 * que le manda, no solo suyo.
 *
 * `hoy` se pasa como texto `YYYY-MM-DD` y no como `Date` a propósito: la fecha
 * que importa es la de Panamá, y construirla aquí desde el reloj del servidor
 * —que corre en UTC— haría que un documento venciera unas horas antes de tiempo.
 * Quien llama decide qué día es hoy; esta función solo compara.
 */
export function documentosPorVencer(
  documentos: readonly DocumentoDelMotorizado[],
  hoy: string,
  diasDeAviso = 30,
): { documento: DocumentoDelMotorizado; diasRestantes: number }[] {
  const limite = new Date(`${hoy}T00:00:00Z`).getTime();
  if (!Number.isFinite(limite)) return [];

  const avisos: { documento: DocumentoDelMotorizado; diasRestantes: number }[] = [];

  for (const documento of documentos) {
    if (!documento.vence) continue;

    const vence = new Date(`${documento.vence}T00:00:00Z`).getTime();
    if (!Number.isFinite(vence)) continue;

    const diasRestantes = Math.round((vence - limite) / 86_400_000);
    if (diasRestantes <= diasDeAviso) avisos.push({ documento, diasRestantes });
  }

  // Lo más urgente primero, y lo ya vencido antes que lo que está por vencer.
  return avisos.sort((a, b) => a.diasRestantes - b.diasRestantes);
}
