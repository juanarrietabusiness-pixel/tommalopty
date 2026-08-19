/**
 * Contrato común de las pasarelas de pago.
 *
 * El checkout habla solo con esta interfaz: añadir o quitar una pasarela no
 * debe tocar el frontend (brief §3). Ninguna implementación recibe ni almacena
 * datos de tarjeta: la tokenización ocurre siempre en el widget/SDK del
 * proveedor, y aquí solo circulan identificadores.
 */

export type PaymentProviderId = 'paypal' | 'wompi' | 'paguelofacil' | 'yappy' | 'manual';

export type PaymentEnvironment = 'sandbox' | 'production';

export interface PaymentAmount {
  /** Importe total en la moneda del pedido (USD en Panamá). */
  value: number;
  currency: 'USD';
}

export interface PaymentCustomer {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
}

export interface PaymentLineItem {
  name: string;
  sku?: string | null;
  quantity: number;
  unitPrice: number;
}

export interface CreatePaymentInput {
  orderId: string;
  orderNumber: string;
  amount: PaymentAmount;
  customer: PaymentCustomer;
  items: PaymentLineItem[];
  /** URL a la que vuelve el comprador tras aprobar el pago. */
  returnUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}

export interface CreatePaymentResult {
  /** Identificador del intento de pago en el proveedor. */
  providerPaymentId: string;
  /** URL de redirección, si la pasarela usa checkout alojado. */
  redirectUrl?: string;
  /** Datos que el widget de cliente necesita para renderizarse. */
  clientPayload?: Record<string, unknown>;
  status: 'requires_action' | 'pending' | 'authorized' | 'paid';
}

export interface CapturePaymentInput {
  orderId: string;
  providerPaymentId: string;
  amount: PaymentAmount;
}

export interface CapturePaymentResult {
  providerPaymentId: string;
  status: 'paid' | 'authorized' | 'failed';
  rawResponse: Record<string, unknown>;
}

export interface RefundPaymentInput {
  providerPaymentId: string;
  amount: PaymentAmount;
  reason?: string;
}

export interface RefundPaymentResult {
  providerRefundId: string;
  status: 'refunded' | 'partially_refunded' | 'failed';
  rawResponse: Record<string, unknown>;
}

/** Resultado de verificar la firma de un webhook entrante. */
export interface WebhookVerification {
  isValid: boolean;
  eventId: string | null;
  eventType: string | null;
  /** Estado al que debe pasar el pedido, si el evento lo determina. */
  paymentStatus: 'paid' | 'authorized' | 'failed' | 'refunded' | 'cancelled' | null;
  providerPaymentId: string | null;
  orderReference: string | null;
}

export interface PaymentProviderConfig {
  environment: PaymentEnvironment;
  [key: string]: unknown;
}

export interface PaymentProvider {
  readonly id: PaymentProviderId;
  readonly label: string;
  /** Métodos que ofrece, para pintarlos en el checkout. */
  readonly methods: readonly string[];
  /** true cuando hay credenciales cargadas en el entorno actual. */
  isConfigured(): boolean;
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  capturePayment(input: CapturePaymentInput): Promise<CapturePaymentResult>;
  refundPayment(input: RefundPaymentInput): Promise<RefundPaymentResult>;
  /**
   * Verifica la firma del webhook y extrae el evento.
   * Debe ser idempotente: la misma notificación puede llegar varias veces.
   */
  verifyWebhook(request: {
    body: string;
    headers: Record<string, string>;
  }): Promise<WebhookVerification>;
}
