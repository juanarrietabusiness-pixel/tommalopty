import type { Json } from '@nebula/db';

/**
 * Leer el destino de un envío, que llega como `jsonb`.
 *
 * La columna guarda una instantánea de la dirección tal como estaba cuando el
 * envío salió, y una instantánea no tiene esquema garantizado: un pedido antiguo
 * puede no traer teléfono, y uno creado a mano desde el panel puede no traer
 * casi nada. Se lee campo a campo y lo que no sea texto se descarta, en vez de
 * confiar en una forma que la base no obliga.
 *
 * Vive aparte porque lo usan la página del QR y la aplicación del motorizado, y
 * las dos tienen que enseñar exactamente la misma dirección: si difieren, quien
 * entrega ve una cosa en el papel y otra en el teléfono.
 */
export interface DestinoDeEntrega {
  firstName?: string;
  lastName?: string;
  line1?: string;
  line2?: string;
  city?: string;
  province?: string;
  phone?: string;
  reference?: string;
  deliveryInstructions?: string;
}

const CAMPOS = [
  'firstName',
  'lastName',
  'line1',
  'line2',
  'city',
  'province',
  'phone',
  'reference',
  'deliveryInstructions',
] as const;

export function destinoDelEnvio(valor: Json): DestinoDeEntrega {
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) return {};

  const crudo = valor as Record<string, unknown>;
  const destino: DestinoDeEntrega = {};

  for (const campo of CAMPOS) {
    const texto = crudo[campo];
    if (typeof texto === 'string' && texto.trim()) destino[campo] = texto.trim();
  }

  return destino;
}

/**
 * Una línea que identifique el sitio, para una lista.
 *
 * La calle primero y el barrio después, que es el orden en el que se busca una
 * puerta. Si no hay ninguna de las dos, el nombre de quien recibe: es peor que
 * una dirección, pero es infinitamente mejor que una tarjeta vacía en la que no
 * se puede ni tocar para ver qué había dentro.
 */
export function resumenDeDestino(destino: DestinoDeEntrega): string {
  const partes = [destino.line1, destino.city].filter(Boolean);
  if (partes.length > 0) return partes.join(', ');

  const nombre = [destino.firstName, destino.lastName].filter(Boolean).join(' ');
  return nombre || 'Sin dirección escrita';
}

/** Nombre de quien recibe, o cadena vacía. */
export function nombreDeQuienRecibe(destino: DestinoDeEntrega): string {
  return [destino.firstName, destino.lastName].filter(Boolean).join(' ');
}
