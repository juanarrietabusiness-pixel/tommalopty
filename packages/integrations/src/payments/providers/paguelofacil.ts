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
 * PagueloFacil — tarjetas y Clave (débito local). Sin costo de setup;
 * requiere cuenta bancaria en Panamá.
 *
 * PENDIENTE DE IMPLEMENTAR. Pasos:
 *  1. createPayment -> generar el enlace de pago (LinkDeamon) con
 *     PAGUELOFACIL_CCLW y devolver `redirectUrl`.
 *  2. capturePayment -> consultar la transacción por su código de operación.
 *  3. refundPayment  -> solicitud de reverso con PAGUELOFACIL_ACCESS_TOKEN.
 *  4. verifyWebhook  -> validar el retorno consultando la transacción contra la
 *     API; no confiar solo en los parámetros de la URL de retorno.
 */
export const pagueloFacilProvider: PaymentProvider = {
  id: 'paguelofacil',
  label: 'PagueloFacil',
  methods: ['card', 'clave'],

  isConfigured() {
    return Boolean(process.env.PAGUELOFACIL_CCLW);
  },

  createPayment(_input: CreatePaymentInput): Promise<CreatePaymentResult> {
    throw new NotImplementedError('paguelofacil', 'createPayment');
  },

  capturePayment(_input: CapturePaymentInput): Promise<CapturePaymentResult> {
    throw new NotImplementedError('paguelofacil', 'capturePayment');
  },

  refundPayment(_input: RefundPaymentInput): Promise<RefundPaymentResult> {
    throw new NotImplementedError('paguelofacil', 'refundPayment');
  },

  verifyWebhook(_request: {
    body: string;
    headers: Record<string, string>;
  }): Promise<WebhookVerification> {
    throw new NotImplementedError('paguelofacil', 'verifyWebhook');
  },
};
