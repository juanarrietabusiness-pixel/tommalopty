import { describe, expect, it } from 'vitest';
import { conciliar, registrablesSinRevision, type PedidoPorCobrar } from './conciliacion';
import type { TransaccionYappy } from './tipos';

const PEDIDOS: PedidoPorCobrar[] = [
  { orderNumber: 'NB-001234', total: 45, pagado: 0 },
  { orderNumber: 'NB-001235', total: 100, pagado: 60 },
];

function cobro(extra: Partial<TransaccionYappy> = {}): TransaccionYappy {
  return {
    id: 'ABCDE-76456',
    number: '94821',
    type: 'TXN-COM',
    role: 'CREDIT',
    status: 'COMPLETED',
    payment_date: '2026-08-30T10:00:55.000Z',
    charge: { amount: 45, currency: 'USD' },
    ...extra,
  };
}

describe('conciliar', () => {
  it('ata el cobro al pedido por su referencia', () => {
    const { emparejadas, huerfanas } = conciliar([cobro({ referenceId: 'NB-001234' })], PEDIDOS);

    expect(huerfanas).toHaveLength(0);
    expect(emparejadas).toHaveLength(1);
    expect(emparejadas[0]).toMatchObject({
      orderNumber: 'NB-001234',
      importe: 45,
      certeza: 'referencia',
      referenciaBanco: '94821',
      excedeElTotal: false,
    });
  });

  it('encuentra el número dentro del concepto, con menos certeza', () => {
    const { emparejadas } = conciliar(
      [cobro({ description: 'Abono pedido NB-001234, gracias' })],
      PEDIDOS,
    );

    expect(emparejadas[0]?.orderNumber).toBe('NB-001234');
    expect(emparejadas[0]?.certeza).toBe('descripcion');
  });

  it('también mira el concepto de la factura', () => {
    const { emparejadas } = conciliar([cobro({ bill_description: 'NB-001235' })], PEDIDOS);
    expect(emparejadas[0]?.orderNumber).toBe('NB-001235');
  });

  /*
   * Sin fronteras en la búsqueda, `NB-001234` haría juego dentro de
   * `NB-0012345`, y el pago de un pedido se apuntaría en otro. Es el falso
   * positivo más fácil de escribir y el más caro de descubrir.
   */
  it('no confunde un número de pedido con el prefijo de otro', () => {
    const { huerfanas } = conciliar([cobro({ description: 'pago NB-0012345' })], PEDIDOS);
    expect(huerfanas).toHaveLength(1);
  });

  it('deja huérfano lo que no menciona ningún pedido', () => {
    const { emparejadas, huerfanas } = conciliar([cobro({ description: 'Pago varios' })], PEDIDOS);

    expect(emparejadas).toHaveLength(0);
    expect(huerfanas).toHaveLength(1);
  });

  it('marca el cobro que se pasa del saldo pendiente', () => {
    // El pedido NB-001235 debe 40 y entran 100.
    const { emparejadas } = conciliar(
      [cobro({ referenceId: 'NB-001235', charge: { amount: 100, currency: 'USD' } })],
      PEDIDOS,
    );

    expect(emparejadas[0]?.excedeElTotal).toBe(true);
  });

  it('acepta el abono que cuadra justo con el saldo', () => {
    const { emparejadas } = conciliar(
      [cobro({ referenceId: 'NB-001235', charge: { amount: 40, currency: 'USD' } })],
      PEDIDOS,
    );

    expect(emparejadas[0]?.excedeElTotal).toBe(false);
  });

  describe('lo que no es un cobro', () => {
    it('descarta el dinero que sale', () => {
      const { descartadas } = conciliar(
        [cobro({ role: 'DEBIT', referenceId: 'NB-001234' })],
        PEDIDOS,
      );
      expect(descartadas).toBe(1);
    });

    it('descarta lo que no llegó a cobrarse', () => {
      for (const status of ['PENDING', 'DECLINED', 'EXPIRED', 'REVERSED', 'FAILED']) {
        const { descartadas } = conciliar([cobro({ status, referenceId: 'NB-001234' })], PEDIDOS);
        expect(descartadas, status).toBe(1);
      }
    });

    it('acepta EXECUTED además de COMPLETED', () => {
      const { emparejadas } = conciliar(
        [cobro({ status: 'EXECUTED', referenceId: 'NB-001234' })],
        PEDIDOS,
      );
      expect(emparejadas).toHaveLength(1);
    });

    it('descarta otra divisa: el pedido es en dólares', () => {
      const { descartadas } = conciliar(
        [cobro({ referenceId: 'NB-001234', charge: { amount: 45, currency: 'EUR' } })],
        PEDIDOS,
      );
      expect(descartadas).toBe(1);
    });

    it('descarta el movimiento sin importe', () => {
      const { descartadas } = conciliar([cobro({ referenceId: 'NB-001234', charge: {} })], PEDIDOS);
      expect(descartadas).toBe(1);
    });

    it('descarta el rol ausente en vez de suponer que entró dinero', () => {
      const { descartadas } = conciliar(
        [cobro({ role: undefined, referenceId: 'NB-001234' })],
        PEDIDOS,
      );
      expect(descartadas).toBe(1);
    });
  });

  /*
   * Los rangos de fechas de dos conciliaciones seguidas se solapan siempre —es
   * la única forma de no perder un pago que entró justo en el corte— así que la
   * misma transacción llega dos veces. Sin esto se cobraría dos veces.
   */
  it('no vuelve a registrar una transacción ya apuntada', () => {
    const transaccion = cobro({ referenceId: 'NB-001234' });
    const { emparejadas, descartadas } = conciliar(
      [transaccion],
      PEDIDOS,
      new Set(['ABCDE-76456']),
    );

    expect(emparejadas).toHaveLength(0);
    expect(descartadas).toBe(1);
  });

  it('admite varios abonos al mismo pedido', () => {
    const { emparejadas } = conciliar(
      [
        cobro({ id: 'UNO', referenceId: 'NB-001235', charge: { amount: 20, currency: 'USD' } }),
        cobro({ id: 'DOS', referenceId: 'NB-001235', charge: { amount: 20, currency: 'USD' } }),
      ],
      PEDIDOS,
    );

    expect(emparejadas).toHaveLength(2);
    expect(emparejadas.every((pareja) => pareja.orderNumber === 'NB-001235')).toBe(true);
  });
});

describe('registrablesSinRevision', () => {
  it('solo pasa lo que trae referencia y no se excede', () => {
    const resultado = conciliar(
      [
        cobro({ id: 'BUENA', referenceId: 'NB-001234' }),
        cobro({ id: 'TEXTO', description: 'pedido NB-001234' }),
        cobro({
          id: 'EXCESO',
          referenceId: 'NB-001235',
          charge: { amount: 500, currency: 'USD' },
        }),
      ],
      PEDIDOS,
    );

    expect(registrablesSinRevision(resultado).map((pareja) => pareja.transaccionId)).toEqual([
      'BUENA',
    ]);
  });
});
