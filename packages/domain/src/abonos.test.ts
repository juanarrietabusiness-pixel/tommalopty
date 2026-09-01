import { describe, expect, it } from 'vitest';
import {
  POLITICAS_DE_DESPACHO,
  POLITICA_LABELS,
  REGLA_POR_DEFECTO,
  decidirDespacho,
  estadoDePagoSegunSaldo,
  isPoliticaDeDespacho,
  type ReglaDeDespacho,
} from './abonos';

const ESTRICTA: ReglaDeDespacho = { politica: 'estricta', umbralPorcentaje: 50 };
const MITAD: ReglaDeDespacho = { politica: 'umbral', umbralPorcentaje: 50 };
const CONTRA_ENTREGA: ReglaDeDespacho = { politica: 'contra_entrega', umbralPorcentaje: 0 };

describe('la regla por defecto', () => {
  // Es la única de las tres que no puede acabar en pérdida. Las otras dos son
  // decisiones que alguien tiene que tomar a sabiendas.
  it('es la estricta, para que nadie despache con saldo sin quererlo', () => {
    expect(REGLA_POR_DEFECTO.politica).toBe('estricta');
  });
});

describe('decidirDespacho · política estricta', () => {
  it('no deja salir un pedido con saldo', () => {
    const decision = decidirDespacho({ total: 300, pagado: 200, regla: ESTRICTA });

    expect(decision.puede).toBe(false);
    expect(decision.faltaPorCobrar).toBe(100);
  });

  it('deja salir cuando el saldo llega a cero', () => {
    expect(decidirDespacho({ total: 300, pagado: 300, regla: ESTRICTA }).puede).toBe(true);
  });

  it('deja salir si pagaron de más', () => {
    const decision = decidirDespacho({ total: 300, pagado: 320, regla: ESTRICTA });

    expect(decision.puede).toBe(true);
    expect(decision.faltaPorCobrar).toBe(0);
  });
});

describe('decidirDespacho · política de umbral', () => {
  it('deja salir justo al alcanzar el porcentaje', () => {
    expect(decidirDespacho({ total: 300, pagado: 150, regla: MITAD }).puede).toBe(true);
  });

  it('no deja salir un céntimo por debajo', () => {
    const decision = decidirDespacho({ total: 300, pagado: 149.99, regla: MITAD });

    expect(decision.puede).toBe(false);
    expect(decision.faltaPorCobrar).toBe(0.01);
  });

  // El saldo que queda sigue siendo el saldo real, no lo que faltaba para el
  // umbral: quien despacha necesita saber cuánto se le debe todavía.
  it('cuando deja salir, informa del saldo que queda', () => {
    const decision = decidirDespacho({ total: 300, pagado: 150, regla: MITAD });

    expect(decision.faltaPorCobrar).toBe(150);
  });

  it('un umbral fuera de rango se acota en vez de romper la cuenta', () => {
    const absurdo: ReglaDeDespacho = { politica: 'umbral', umbralPorcentaje: 500 };
    expect(decidirDespacho({ total: 100, pagado: 99, regla: absurdo }).puede).toBe(false);

    const negativo: ReglaDeDespacho = { politica: 'umbral', umbralPorcentaje: -20 };
    expect(decidirDespacho({ total: 100, pagado: 0.01, regla: negativo }).puede).toBe(true);
  });
});

describe('decidirDespacho · contra entrega', () => {
  it('deja salir con saldo y dice cuánto hay que cobrar en la puerta', () => {
    const decision = decidirDespacho({ total: 300, pagado: 100, regla: CONTRA_ENTREGA });

    expect(decision.puede).toBe(true);
    expect(decision.faltaPorCobrar).toBe(200);
    expect(decision.motivo).toContain('200.00');
  });
});

describe('decidirDespacho · aritmética del dinero', () => {
  /**
   * El caso que obliga a redondear. Dos abonos de 1.10 y 2.20 sobre un pedido
   * de 3.30 no suman 3.30 en coma flotante: suman 3.3000000000000003. Sin
   * redondeo, ese pedido se queda sin poder salir por una diezmilbillonésima
   * que no existe en ninguna caja registradora.
   *
   * El primer intento de este test usaba 33.34 + 33.33 + 33.33 sobre 100, que
   * da exactamente 100 y por tanto no probaba nada. Se comprueba de paso que
   * la suma es de verdad inexacta, para que el día que alguien cambie los
   * números el test avise en vez de volverse decorativo.
   */
  it('dos abonos que suman el total dejan salir el pedido', () => {
    const pagado = 1.1 + 2.2;

    expect(pagado).not.toBe(3.3); // así es la coma flotante
    expect(decidirDespacho({ total: 3.3, pagado, regla: ESTRICTA }).puede).toBe(true);
  });

  it('un pedido sin importe no bloquea a nadie', () => {
    expect(decidirDespacho({ total: 0, pagado: 0, regla: ESTRICTA }).puede).toBe(true);
  });

  it('un pagado negativo se trata como cero, no como crédito', () => {
    const decision = decidirDespacho({ total: 100, pagado: -50, regla: ESTRICTA });

    expect(decision.puede).toBe(false);
    expect(decision.faltaPorCobrar).toBe(100);
  });

  it('no se rompe con valores que no son números', () => {
    const decision = decidirDespacho({
      total: Number.NaN,
      pagado: Number.POSITIVE_INFINITY,
      regla: ESTRICTA,
    });

    expect(decision.puede).toBe(true);
  });
});

describe('estadoDePagoSegunSaldo', () => {
  it('recorre los tres estados según entra el dinero', () => {
    expect(estadoDePagoSegunSaldo(300, 0)).toBe('pending');
    expect(estadoDePagoSegunSaldo(300, 100)).toBe('partially_paid');
    expect(estadoDePagoSegunSaldo(300, 300)).toBe('paid');
  });

  it('pagar de más sigue siendo pagado', () => {
    expect(estadoDePagoSegunSaldo(300, 400)).toBe('paid');
  });

  // El caso del criterio de aceptación del plan: $300 en tres abonos de $100.
  it('el pedido de 300 con tres abonos de 100 termina pagado', () => {
    expect(estadoDePagoSegunSaldo(300, 100)).toBe('partially_paid');
    expect(estadoDePagoSegunSaldo(300, 200)).toBe('partially_paid');
    expect(estadoDePagoSegunSaldo(300, 300)).toBe('paid');
  });
});

describe('coherencia', () => {
  it('toda política tiene etiqueta', () => {
    expect(Object.keys(POLITICA_LABELS).sort()).toEqual([...POLITICAS_DE_DESPACHO].sort());
  });

  it('isPoliticaDeDespacho reconoce las tres y rechaza el resto', () => {
    for (const politica of POLITICAS_DE_DESPACHO) {
      expect(isPoliticaDeDespacho(politica)).toBe(true);
    }
    expect(isPoliticaDeDespacho('contra entrega')).toBe(false);
    expect(isPoliticaDeDespacho('')).toBe(false);
  });

  // Ninguna política puede impedir que salga un pedido ya pagado: sería dinero
  // cobrado y mercancía retenida.
  it('ninguna política retiene un pedido pagado del todo', () => {
    for (const politica of POLITICAS_DE_DESPACHO) {
      const decision = decidirDespacho({
        total: 300,
        pagado: 300,
        regla: { politica, umbralPorcentaje: 100 },
      });

      expect(decision.puede, `la política ${politica} retuvo un pedido pagado`).toBe(true);
    }
  });
});
