import { NotImplementedError } from '../errors';
import type {
  CapturePaymentInput,
  CapturePaymentResult,
  CreatePaymentInput,
  CreatePaymentResult,
  PaymentProvider,
  RefundPaymentInput,
  RefundPaymentResult,
  WebhookVerification,
} from '../types';

/**
 * Wompi (Banistmo) — tarjetas de crédito y débito locales.
 * Comisión de referencia: ~2.75% + $0.25 por transacción.
 *
 * PENDIENTE DE IMPLEMENTAR. Pasos:
 *  1. createPayment -> crear transacción con WOMPI_PRIVATE_KEY. El token de la
 *     tarjeta lo genera el widget de cliente con WOMPI_PUBLIC_KEY.
 *  2. capturePayment -> consultar la transacción y mapear su estado.
 *  3. refundPayment  -> endpoint de anulación/reembolso del comercio.
 *  4. verifyWebhook  -> recalcular el checksum SHA-256 que Wompi documenta
 *     (concatenación de propiedades + timestamp + WOMPI_EVENTS_SECRET) y
 *     compararlo en tiempo constante con la firma recibida.
 *
 * Confirmar importes y endpoints vigentes con la documentación del comercio
 * antes de implementar: cambian con el contrato.
 */
export const wompiProvider: PaymentProvider = {
  id: 'wompi',
  label: 'Wompi (Banistmo)',
  methods: ['card'],

  isConfigured() {
    return Boolean(process.env.WOMPI_PUBLIC_KEY && process.env.WOMPI_PRIVATE_KEY);
  },

  createPayment(_input: CreatePaymentInput): Promise<CreatePaymentResult> {
    throw new NotImplementedError('wompi', 'createPayment');
  },

  capturePayment(_input: CapturePaymentInput): Promise<CapturePaymentResult> {
    throw new NotImplementedError('wompi', 'capturePayment');
  },

  refundPayment(_input: RefundPaymentInput): Promise<RefundPaymentResult> {
    throw new NotImplementedError('wompi', 'refundPayment');
  },

  verifyWebhook(_request: {
    body: string;
    headers: Record<string, string>;
  }): Promise<WebhookVerification> {
    throw new NotImplementedError('wompi', 'verifyWebhook');
  },
};
