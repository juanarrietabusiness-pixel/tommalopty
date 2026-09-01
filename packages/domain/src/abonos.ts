/**
 * Abonos: cobrar un pedido por partes, y decidir cuándo puede salir.
 *
 * Es la fase L3 del plan de logística, y responde a una pregunta concreta de la
 * dueña del negocio: «¿puedo recibir abonos y despachar cuando se complete el
 * pago?». La respuesta tiene dos mitades. Una es aritmética —cuánto lleva
 * pagado— y vive en la base de datos. La otra es una decisión de negocio —cuánto
 * hace falta para despachar— y vive aquí, porque no es la misma para todos los
 * pedidos ni para todos los negocios.
 */

/**
 * Cuándo se deja salir un pedido que todavía debe dinero.
 *
 * Las tres existen porque las tres son razonables, y cuál conviene depende del
 * ticket, del cliente y de la confianza. Se elige en los ajustes, no en el
 * código: el día que la dueña quiera cambiarla no debería hacer falta un
 * despliegue.
 */
export const POLITICAS_DE_DESPACHO = ['estricta', 'umbral', 'contra_entrega'] as const;

export type PoliticaDeDespacho = (typeof POLITICAS_DE_DESPACHO)[number];

export function isPoliticaDeDespacho(value: string): value is PoliticaDeDespacho {
  return (POLITICAS_DE_DESPACHO as readonly string[]).includes(value);
}

export const POLITICA_LABELS: Record<PoliticaDeDespacho, string> = {
  estricta: 'No despachar hasta que el saldo esté en cero',
  umbral: 'Despachar al alcanzar un porcentaje del total',
  contra_entrega: 'Despachar con saldo, y cobrar el resto al entregar',
};

export interface ReglaDeDespacho {
  politica: PoliticaDeDespacho;
  /** Solo se usa con la política de umbral. Porcentaje del total, de 0 a 100. */
  umbralPorcentaje: number;
}

/**
 * La regla por defecto, y por qué es la estricta.
 *
 * Es la única de las tres que no puede acabar en pérdida: si el pedido no sale
 * hasta que el dinero está, no hay mercancía en la calle contra una promesa.
 * Las otras dos son decisiones que alguien tiene que tomar a sabiendas, y por
 * eso ninguna es el valor por defecto — que nadie las active sin querer.
 */
export const REGLA_POR_DEFECTO: ReglaDeDespacho = {
  politica: 'estricta',
  umbralPorcentaje: 50,
};

export interface DecisionDeDespacho {
  puede: boolean;
  /** Qué falta, en dinero, para poder despachar. Cero si ya se puede. */
  faltaPorCobrar: number;
  motivo: string;
}

/**
 * ¿Puede salir este pedido?
 *
 * Los importes llegan en la moneda del pedido, no en centavos, porque así es
 * como están en la base. Se redondea a dos decimales antes de comparar: sin
 * eso, un pedido de 100 pagado con tres abonos de 33.34, 33.33 y 33.33 puede
 * dar 99.99999999 y quedarse sin poder salir por una milésima que no existe en
 * ninguna caja registradora.
 */
export function decidirDespacho(input: {
  total: number;
  pagado: number;
  regla: ReglaDeDespacho;
}): DecisionDeDespacho {
  const total = redondear(input.total);
  const pagado = redondear(Math.max(input.pagado, 0));
  const saldo = redondear(Math.max(total - pagado, 0));

  // Un pedido sin importe no tiene nada que cobrar, y bloquearlo sería absurdo.
  if (total <= 0) {
    return { puede: true, faltaPorCobrar: 0, motivo: 'El pedido no tiene importe pendiente.' };
  }

  if (saldo <= 0) {
    return { puede: true, faltaPorCobrar: 0, motivo: 'El pedido está pagado por completo.' };
  }

  switch (input.regla.politica) {
    case 'contra_entrega':
      return {
        puede: true,
        faltaPorCobrar: saldo,
        motivo: `Sale con saldo: hay que cobrar ${saldo.toFixed(2)} al entregar.`,
      };

    case 'umbral': {
      const minimo = redondear((total * acotarPorcentaje(input.regla.umbralPorcentaje)) / 100);

      if (pagado >= minimo) {
        return {
          puede: true,
          faltaPorCobrar: saldo,
          motivo: `Superó el ${acotarPorcentaje(input.regla.umbralPorcentaje)} % exigido para despachar.`,
        };
      }

      return {
        puede: false,
        faltaPorCobrar: redondear(minimo - pagado),
        motivo:
          `Faltan ${redondear(minimo - pagado).toFixed(2)} para alcanzar el ` +
          `${acotarPorcentaje(input.regla.umbralPorcentaje)} % que hace falta para despachar.`,
      };
    }

    case 'estricta':
    default:
      return {
        puede: false,
        faltaPorCobrar: saldo,
        motivo: `Faltan ${saldo.toFixed(2)} por cobrar antes de despachar.`,
      };
  }
}

/**
 * En qué estado de pago queda un pedido según lo que lleva cobrado.
 *
 * Se deriva y no se escribe a mano en ningún sitio: dos formas de decidir el
 * mismo estado acaban discrepando, y quien mire el pedido no sabrá cuál creer.
 */
export function estadoDePagoSegunSaldo(
  total: number,
  pagado: number,
): 'pending' | 'partially_paid' | 'paid' {
  const t = redondear(total);
  const p = redondear(Math.max(pagado, 0));

  if (p <= 0) return 'pending';
  if (p >= t) return 'paid';
  return 'partially_paid';
}

/** Los importes de dinero se comparan con dos decimales, nunca en crudo. */
function redondear(valor: number): number {
  if (!Number.isFinite(valor)) return 0;
  return Math.round(valor * 100) / 100;
}

function acotarPorcentaje(valor: number): number {
  if (!Number.isFinite(valor)) return 0;
  return Math.min(Math.max(Math.round(valor), 0), 100);
}
