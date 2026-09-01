import { describe, expect, it } from 'vitest';
import {
  ESTADOS_DESDE_LA_CALLE,
  SHIPMENT_STATUSES,
  SHIPMENT_STATUS_LABELS,
  allowedShipmentTransitions,
  canTransitionShipment,
  estaEnLaCalle,
  isShipmentStatus,
  isTerminalShipmentStatus,
  validateShipmentTransition,
  type ShipmentStatus,
} from './shipment-state';

describe('canTransitionShipment', () => {
  it('deja recorrer el camino normal de principio a fin', () => {
    const camino: ShipmentStatus[] = ['pendiente', 'asignado', 'recogido', 'en_ruta', 'entregado'];

    for (let i = 0; i < camino.length - 1; i += 1) {
      expect(canTransitionShipment(camino[i]!, camino[i + 1]!)).toBe(true);
    }
  });

  // El caso que motiva toda la máquina: quien marca estos estados va en la
  // calle, con una mano en el manillar. Los toques accidentales existen.
  it('no deja retroceder desde entregado', () => {
    for (const destino of SHIPMENT_STATUSES) {
      if (destino === 'entregado') continue;
      expect(canTransitionShipment('entregado', destino)).toBe(false);
    }
  });

  it('no deja saltarse pasos', () => {
    expect(canTransitionShipment('pendiente', 'en_ruta')).toBe(false);
    expect(canTransitionShipment('pendiente', 'entregado')).toBe(false);
    expect(canTransitionShipment('asignado', 'entregado')).toBe(false);
  });

  it('acepta quedarse donde está', () => {
    for (const estado of SHIPMENT_STATUSES) {
      expect(canTransitionShipment(estado, estado)).toBe(true);
    }
  });

  it('deja desasignar un envío que todavía no salió', () => {
    expect(canTransitionShipment('asignado', 'pendiente')).toBe(true);
  });

  /**
   * Un fallido no salta a entregado. Si al final se entregó, hubo un segundo
   * intento, y ese intento tiene que constar: vuelve a la cola y recorre el
   * camino otra vez. Es lo que permite contar cuántas entregas se intentaron
   * dos veces, que es justo el número que dice si el dato de dirección sirve.
   */
  it('un intento fallido se reintenta o se devuelve, pero no se da por entregado', () => {
    expect(canTransitionShipment('fallido', 'pendiente')).toBe(true);
    expect(canTransitionShipment('fallido', 'devuelto')).toBe(true);
    expect(canTransitionShipment('fallido', 'entregado')).toBe(false);
  });

  it('desde cualquier estado vivo se puede fallar', () => {
    for (const estado of ['pendiente', 'asignado', 'recogido', 'en_ruta'] as const) {
      expect(canTransitionShipment(estado, 'fallido')).toBe(true);
    }
  });
});

describe('isTerminalShipmentStatus', () => {
  it('entregado y devuelto son el final del camino', () => {
    expect(isTerminalShipmentStatus('entregado')).toBe(true);
    expect(isTerminalShipmentStatus('devuelto')).toBe(true);
  });

  it('fallido no es terminal: todavía se puede reintentar', () => {
    expect(isTerminalShipmentStatus('fallido')).toBe(false);
  });
});

describe('estaEnLaCalle', () => {
  it('reconoce los estados en los que el envío ya salió', () => {
    expect(estaEnLaCalle('recogido')).toBe(true);
    expect(estaEnLaCalle('en_ruta')).toBe(true);
  });

  it('no confunde los de almacén', () => {
    expect(estaEnLaCalle('pendiente')).toBe(false);
    expect(estaEnLaCalle('asignado')).toBe(false);
    expect(estaEnLaCalle('entregado')).toBe(false);
  });
});

describe('lo que puede marcar quien entrega', () => {
  // Asignar y devolver son decisiones de quien despacha. Si esta lista crece
  // sin querer, la página del motorizado empieza a ofrecer botones que no le
  // tocan.
  it('son exactamente dos: entregado y fallido', () => {
    expect([...ESTADOS_DESDE_LA_CALLE]).toEqual(['entregado', 'fallido']);
  });

  it('los dos son alcanzables desde «en camino», que es donde estará', () => {
    for (const estado of ESTADOS_DESDE_LA_CALLE) {
      expect(canTransitionShipment('en_ruta', estado)).toBe(true);
    }
  });
});

describe('validateShipmentTransition', () => {
  it('no se queja de un cambio válido', () => {
    expect(validateShipmentTransition('en_ruta', 'entregado')).toBeNull();
  });

  // El mensaje lo lee una persona, así que nombra los estados como se ven en
  // pantalla y no como se llaman en la base de datos.
  it('explica el cambio inválido con los nombres que se leen', () => {
    const error = validateShipmentTransition('entregado', 'en_ruta');

    expect(error?.message).toBe('Un envío "Entregado" no puede pasar a "En camino".');
  });
});

describe('isShipmentStatus', () => {
  it('reconoce los siete estados', () => {
    for (const estado of SHIPMENT_STATUSES) {
      expect(isShipmentStatus(estado)).toBe(true);
    }
  });

  it('rechaza cualquier otra cosa', () => {
    expect(isShipmentStatus('en ruta')).toBe(false);
    expect(isShipmentStatus('shipped')).toBe(false);
    expect(isShipmentStatus('')).toBe(false);
  });
});

describe('coherencia de la máquina', () => {
  it('todo estado tiene etiqueta y toda etiqueta tiene estado', () => {
    expect(Object.keys(SHIPMENT_STATUS_LABELS).sort()).toEqual([...SHIPMENT_STATUSES].sort());
  });

  // Un destino que no existe en la lista de estados sería un estado fantasma:
  // la máquina lo aceptaría y ninguna pantalla sabría dibujarlo.
  it('ninguna transición apunta a un estado inexistente', () => {
    for (const estado of SHIPMENT_STATUSES) {
      for (const destino of allowedShipmentTransitions(estado)) {
        expect(SHIPMENT_STATUSES).toContain(destino);
      }
    }
  });

  it('desde cualquier estado vivo se llega a entregado o a devuelto', () => {
    for (const inicio of SHIPMENT_STATUSES) {
      if (isTerminalShipmentStatus(inicio)) continue;

      const vistos = new Set<ShipmentStatus>([inicio]);
      const pendientes: ShipmentStatus[] = [inicio];
      let llega = false;

      while (pendientes.length > 0) {
        const actual = pendientes.pop()!;
        if (isTerminalShipmentStatus(actual)) {
          llega = true;
          break;
        }
        for (const siguiente of allowedShipmentTransitions(actual)) {
          if (vistos.has(siguiente)) continue;
          vistos.add(siguiente);
          pendientes.push(siguiente);
        }
      }

      expect(llega, `${inicio} no llega a ningún estado final`).toBe(true);
    }
  });
});
