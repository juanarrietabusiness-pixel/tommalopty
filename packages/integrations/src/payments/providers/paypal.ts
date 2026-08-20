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
 * PayPal Checkout — cobertura internacional.
 *
 * PENDIENTE DE IMPLEMENTAR. Pasos:
 *  1. Obtener token OAuth2 (`POST /v1/oauth2/token`) con PAYPAL_CLIENT_ID y
 *     PAYPAL_CLIENT_SECRET, cacheándolo hasta su expiración.
 *  2. createPayment  -> `POST /v2/checkout/orders` con intent CAPTURE.
 *  3. capturePayment -> `POST /v2/checkout/orders/{id}/capture`.
 *  4. refundPayment  -> `POST /v2/payments/captures/{id}/refund`.
 *  5. verifyWebhook  -> `POST /v1/notifications/verify-webhook-signature`
 *     usando PAYPAL_WEBHOOK_ID y las cabeceras `paypal-*`.
 *
 * El SDK de cliente se monta en el checkout con NEXT_PUBLIC_PAYPAL_CLIENT_ID:
 * el número de tarjeta nunca toca nuestros servidores.
 */
export const paypalProvider: PaymentProvider = {
  id: 'paypal',
  label: 'PayPal',
  methods: ['paypal', 'card'],

  isConfigured() {
    return Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
  },

  createPayment(_input: CreatePaymentInput): Promise<CreatePaymentResult> {
    throw new NotImplementedError('paypal', 'createPayment');
  },

  capturePayment(_input: CapturePaymentInput): Promise<CapturePaymentResult> {
    throw new NotImplementedError('paypal', 'capturePayment');
  },

  refundPayment(_input: RefundPaymentInput): Promise<RefundPaymentResult> {
    throw new NotImplementedError('paypal', 'refundPayment');
  },

  verifyWebhook(_request: {
    body: string;
    headers: Record<string, string>;
  }): Promise<WebhookVerification> {
    throw new NotImplementedError('paypal', 'verifyWebhook');
  },
};
