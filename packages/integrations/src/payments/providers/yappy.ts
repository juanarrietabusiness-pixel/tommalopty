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
 * Yappy (Banco General) — pago por QR, muy extendido en Panamá.
 * Comisión de referencia: ~1%.
 *
 * PENDIENTE DE IMPLEMENTAR. Pasos:
 *  1. createPayment -> crear la orden con YAPPY_MERCHANT_ID y devolver el
 *     `redirectUrl` / payload del botón para renderizar el QR.
 *  2. capturePayment -> Yappy confirma por notificación; aquí basta con
 *     consultar el estado de la orden.
 *  3. refundPayment  -> proceso de devolución del comercio.
 *  4. verifyWebhook  -> validar el hash firmado con YAPPY_SECRET_KEY.
 */
export const yappyProvider: PaymentProvider = {
  id: 'yappy',
  label: 'Yappy',
  methods: ['qr'],

  isConfigured() {
    return Boolean(process.env.YAPPY_MERCHANT_ID && process.env.YAPPY_SECRET_KEY);
  },

  createPayment(_input: CreatePaymentInput): Promise<CreatePaymentResult> {
    throw new NotImplementedError('yappy', 'createPayment');
  },

  capturePayment(_input: CapturePaymentInput): Promise<CapturePaymentResult> {
    throw new NotImplementedError('yappy', 'capturePayment');
  },

  refundPayment(_input: RefundPaymentInput): Promise<RefundPaymentResult> {
    throw new NotImplementedError('yappy', 'refundPayment');
  },

  verifyWebhook(_request: { body: string; headers: Record<string, string> }): Promise<WebhookVerification> {
    throw new NotImplementedError('yappy', 'verifyWebhook');
  },
};
