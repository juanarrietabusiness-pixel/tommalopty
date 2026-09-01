/**
 * Los tipos de la API de integración de Yappy Comercial, v1.1.0.
 *
 * Se transcriben del `Yappy-Commerce-Integration.yml` que acompaña al manual, y
 * se quedan en `snake_case` a propósito: son el contrato de otro, y renombrarlos
 * a la convención de la casa obliga a mirar dos sitios cada vez que Yappy
 * cambie algo. La traducción a los nombres de aquí ocurre una sola vez, en la
 * frontera, y no antes.
 *
 * Solo está lo que se usa. La especificación trae más campos —comisiones,
 * metadatos de terminal, paginación por token— y se irán añadiendo cuando algo
 * los necesite, no antes.
 */

/** El sobre que envuelve todas las respuestas: `{ body, status }`. */
export interface RespuestaYappy<T> {
  body?: T;
  status: EstadoYappy;
}

export interface EstadoYappy {
  /** `YP-0000` es éxito. El resto están en `codigos.ts`. */
  code: string;
  description: string;
}

export interface SesionYappy {
  token?: { token?: string };
  state?: string;
  open_at?: string;
}

/** Estado de una transacción, tal como lo devuelve Yappy. */
export const ESTADOS_TRANSACCION = [
  'PENDING',
  'EXECUTED',
  'COMPLETED',
  'DECLINED',
  'EXPIRED',
  'REVERSED',
  'FAILED',
] as const;

export type EstadoTransaccion = (typeof ESTADOS_TRANSACCION)[number];

/**
 * De dónde salió la transacción.
 *
 * `TXN-ECOM` es el botón de pago y `TXN-LINK` el link de pago: son las dos que
 * puede generar una tienda en línea. `TXN-COM` es alguien pagando al comercio
 * desde su app, que es como se pagan hoy los abonos de esta tienda.
 */
export const TIPOS_TRANSACCION = [
  'TXN',
  'TXN-PAY',
  'TXN-COM',
  'TXN-M2M',
  'TXN-CHECKOUT',
  'TXN-POS',
  'TXN-ECOM',
  'TXN-LINK',
] as const;

export type TipoTransaccion = (typeof TIPOS_TRANSACCION)[number];

export interface ImporteYappy {
  amount?: number;
  partial_amount?: number;
  tip?: number;
  tax?: number;
  currency?: string;
}

export interface ContraparteYappy {
  alias?: string;
  complete_name?: string;
  alias_type?: string;
  bank_name?: string;
}

export interface TransaccionYappy {
  id: string;
  /** Referencia del banco. Es lo que aparece en el comprobante del cliente. */
  number?: string;
  registration_date?: string;
  payment_date?: string;
  cut_off_date?: string;
  type: TipoTransaccion | string;
  role?: 'CREDIT' | 'DEBIT' | string;
  category?: string;
  /** Qué identificador usó el comercio: «Cédula», «Nº de pedido»… */
  referenceName?: string;
  /** El valor de ese identificador. Es por donde se ata a un pedido. */
  referenceId?: string;
  charge?: ImporteYappy;
  description?: string;
  bill_description?: string;
  status?: EstadoTransaccion | string;
  debitor?: ContraparteYappy;
  creditor?: ContraparteYappy;
}

export interface PaginacionYappy {
  start_date?: string;
  end_date?: string;
  payment_date?: string | null;
  merchant_date?: string | null;
  has_next_page?: boolean;
  limit?: number;
  /** Cursor opaco. Se devuelve tal cual en la siguiente petición. */
  token?: string;
}

export interface HistorialYappy {
  pagination?: PaginacionYappy;
  transactions?: TransaccionYappy[];
}

/** Los filtros que admite el historial. Son solo estos dos. */
export type FiltroYappy =
  | { id: 'ROLE'; value: 'DEBIT' | 'CREDIT' }
  /** Alias separados por `|`. Yappy admite 25 como máximo. */
  | { id: 'COLLECTION_ALIAS'; value: string };

export const TIPOS_METODO_COBRO = [
  'DIRECTORIO',
  'BOTON_DE_PAGO',
  'PUNTO_YAPPY',
  'INTEGRACION_YAPPY',
  'PUNTO_DE_VENTA',
] as const;

export type TipoMetodoCobro = (typeof TIPOS_METODO_COBRO)[number];

export interface MetodoCobroYappy {
  alias?: string;
  type?: TipoMetodoCobro | string;
  details?: { id?: string; value?: unknown }[];
}

export interface MetodosCobroYappy {
  alias?: string;
  collections?: MetodoCobroYappy[];
}
