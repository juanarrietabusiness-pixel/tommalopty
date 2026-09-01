import type { TransaccionYappy } from './tipos';

/**
 * Atar los movimientos de Yappy a los pedidos que pagan.
 *
 * EL PROBLEMA QUE RESUELVE
 *
 * Hoy los abonos se registran a mano: alguien abre la app del banco, ve que
 * entró un pago, busca de quién es y lo apunta en el panel. Funciona con cinco
 * pedidos al día y se cae con cincuenta. Yappy sabe qué entró y cuándo; lo que
 * no sabe es a qué pedido corresponde, porque eso solo lo sabe esta tienda.
 *
 * POR QUÉ ES PURA
 *
 * Decidir que un pago de $45 es del pedido NB-001234 es una decisión con
 * consecuencias: marca un pedido como cobrado y puede hacer que salga del
 * almacén. Tiene que poder probarse con casos escritos a mano —el pago que
 * cuadra, el que trae la referencia mal, el duplicado, el que llega de más— sin
 * red, sin base de datos y sin credenciales.
 *
 * LO QUE NO HACE, A PROPÓSITO
 *
 * No decide sola. Devuelve emparejamientos con su nivel de certeza y deja que la
 * capa de aplicación decida cuáles registra sin preguntar y cuáles enseña para
 * que una persona confirme. Un falso positivo aquí es mercancía en la calle sin
 * haber cobrado.
 */

/** Estados en los que el dinero ya se movió de verdad. */
const ESTADOS_COBRADOS = new Set(['COMPLETED', 'EXECUTED']);

export interface PedidoPorCobrar {
  orderNumber: string;
  total: number;
  /** Lo que ya se le ha abonado. */
  pagado: number;
}

/**
 * De qué se fía el emparejamiento.
 *
 * `referencia` es el comercio habiendo mandado el número de pedido en el campo
 * que existe justo para eso. `descripcion` es haberlo encontrado escrito dentro
 * de un texto libre, que casi siempre acierta y a veces no: alguien puede poner
 * el número de otro pedido en el concepto de su transferencia.
 */
export type Certeza = 'referencia' | 'descripcion';

export interface Emparejamiento {
  transaccionId: string;
  /** La referencia del banco: es lo que el cliente ve en su comprobante. */
  referenciaBanco: string | null;
  orderNumber: string;
  importe: number;
  fecha: string | null;
  certeza: Certeza;
  /** El pago pasa del total del pedido. Casi siempre es un emparejamiento malo. */
  excedeElTotal: boolean;
}

export interface ResultadoConciliacion {
  emparejadas: Emparejamiento[];
  /** Cobros que no se pudieron atar a ningún pedido. Los mira una persona. */
  huerfanas: TransaccionYappy[];
  /** Movimientos descartados por no ser cobros: salidas, rechazos, otras divisas. */
  descartadas: number;
}

/** El importe que entró, o `null` si el movimiento no lo trae. */
function importeCobrado(transaccion: TransaccionYappy): number | null {
  const bruto = transaccion.charge?.amount;
  return typeof bruto === 'number' && Number.isFinite(bruto) && bruto > 0 ? bruto : null;
}

/** ¿Es dinero que entró al comercio, cobrado de verdad y en dólares? */
function esCobroEntrante(transaccion: TransaccionYappy): boolean {
  // `role` puede faltar en respuestas antiguas. Cuando falta no se asume que sea
  // un cobro: descartar un pago real lo arregla una persona en un minuto, y
  // registrar una salida como si fuera un ingreso descuadra la caja.
  if (transaccion.role !== 'CREDIT') return false;
  if (!ESTADOS_COBRADOS.has(String(transaccion.status))) return false;

  const divisa = transaccion.charge?.currency;
  if (divisa && divisa !== 'USD') return false;

  return importeCobrado(transaccion) !== null;
}

/**
 * ¿Aparece el número de pedido en este texto?
 *
 * Con fronteras a los lados: sin ellas, `NB-001234` haría juego dentro de
 * `NB-0012345`, que es otro pedido. Y sin distinguir mayúsculas, porque quien
 * escribe el concepto de una transferencia escribe como quiere.
 */
function mencionaElPedido(texto: string | undefined, orderNumber: string): boolean {
  if (!texto) return false;

  const escapado = orderNumber.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^\\w-])${escapado}([^\\w-]|$)`, 'i').test(texto);
}

/**
 * Empareja movimientos con pedidos.
 *
 * `yaRegistradas` son los identificadores de transacción que esta tienda ya
 * apuntó. Es lo que hace que volver a ejecutar la conciliación sobre el mismo
 * rango de fechas no cobre dos veces el mismo pago — y ejecutarla dos veces
 * sobre el mismo rango es lo normal, porque los rangos se solapan.
 */
export function conciliar(
  transacciones: readonly TransaccionYappy[],
  pedidos: readonly PedidoPorCobrar[],
  yaRegistradas: ReadonlySet<string> = new Set(),
): ResultadoConciliacion {
  const emparejadas: Emparejamiento[] = [];
  const huerfanas: TransaccionYappy[] = [];
  let descartadas = 0;

  for (const transaccion of transacciones) {
    if (yaRegistradas.has(transaccion.id)) {
      descartadas += 1;
      continue;
    }

    if (!esCobroEntrante(transaccion)) {
      descartadas += 1;
      continue;
    }

    const importe = importeCobrado(transaccion);
    if (importe === null) {
      descartadas += 1;
      continue;
    }

    // Primero por referencia, que es el campo que existe para esto. Solo si no
    // hay, se busca el número dentro de los textos libres.
    const porReferencia = transaccion.referenceId?.trim()
      ? pedidos.find(
          (pedido) =>
            pedido.orderNumber.toUpperCase() === transaccion.referenceId?.trim().toUpperCase(),
        )
      : undefined;

    const porTexto =
      porReferencia ??
      pedidos.find(
        (pedido) =>
          mencionaElPedido(transaccion.description, pedido.orderNumber) ||
          mencionaElPedido(transaccion.bill_description, pedido.orderNumber),
      );

    if (!porTexto) {
      huerfanas.push(transaccion);
      continue;
    }

    emparejadas.push({
      transaccionId: transaccion.id,
      referenciaBanco: transaccion.number ?? null,
      orderNumber: porTexto.orderNumber,
      importe,
      fecha: transaccion.payment_date ?? transaccion.registration_date ?? null,
      certeza: porReferencia ? 'referencia' : 'descripcion',
      // Medio centavo de margen por el redondeo de coma flotante, igual que en
      // `descuadreDeImporte`: la diferencia real siempre es mayor que eso.
      excedeElTotal: importe - (porTexto.total - porTexto.pagado) > 0.005,
    });
  }

  return { emparejadas, huerfanas, descartadas };
}

/**
 * Cuáles se pueden registrar sin preguntar.
 *
 * Solo las que traen la referencia buena y no se pasan del saldo. Todo lo demás
 * —un número encontrado en un texto libre, un pago mayor que lo que se debe— lo
 * mira una persona. La regla es deliberadamente conservadora: el coste de
 * preguntar es un clic, y el de acertar por accidente es un pedido despachado
 * sin cobrar.
 */
export function registrablesSinRevision(resultado: ResultadoConciliacion): Emparejamiento[] {
  return resultado.emparejadas.filter(
    (pareja) => pareja.certeza === 'referencia' && !pareja.excedeElTotal,
  );
}
