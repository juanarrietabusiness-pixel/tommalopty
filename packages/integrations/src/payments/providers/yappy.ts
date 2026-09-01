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
 * Yappy — Botón de Pago (Banco General). Cobrar en el checkout.
 *
 * OJO: SON DOS PRODUCTOS DISTINTOS CON EL MISMO NOMBRE
 *
 * Este adaptador es el **Botón de Pago**: el «Pagar con Yappy» del checkout, que
 * manda al comprador a su app y devuelve el resultado por una notificación
 * (IPN). Es lo que cobra.
 *
 * Lo otro —`src/yappy/`, la «Apificación» o Integración Core de Yappy
 * Comercial— **no cobra**: abre sesión y lee los movimientos ya cobrados. Sirve
 * para conciliar, no para vender.
 *
 * Los dos se llaman Yappy, los dos tienen una «clave secreta» y las
 * credenciales de uno devuelven un error genérico en el otro. Si algo no
 * funciona, lo primero que hay que comprobar es cuál de los dos se está usando.
 *
 * ESTADO: PENDIENTE DE LA ESPECIFICACIÓN OFICIAL
 *
 * Lo que se sabe con certeza, y está confirmado por varias implementaciones
 * públicas:
 *
 *  - Las credenciales son ID de comercio, clave secreta y el dominio del
 *    comercio, que hay que declarar en el portal. Ya se leen abajo.
 *  - Yappy confirma llamando a una URL del comercio con `orderId`, `status`,
 *    `confirmationNumber` y `hash` en la cadena de consulta.
 *  - `status` vale `E` (ejecutado), `R` (rechazado: el cliente no confirmó en
 *    cinco minutos) o `C` (cancelado por el cliente en la app).
 *
 * Lo que **no** se puede escribir sin la documentación de Banco General, y por
 * eso esto sigue lanzando en vez de fingir que funciona:
 *
 *  - El host de la API y las rutas exactas para crear la orden de pago.
 *  - Qué se concatena exactamente para el `hash` de la confirmación.
 *
 * Un pago con endpoints adivinados no se prueba: se rompe con dinero de por
 * medio. La documentación se pide en `botondepagoyappy@bgeneral.com`, y cuando
 * llegue, lo que falta es implementar los cuatro métodos de aquí abajo — el
 * resto de la tienda (checkout, webhooks, idempotencia, comprobación de
 * importe) ya está y no hay que tocarlo.
 */
export const yappyProvider: PaymentProvider = {
  id: 'yappy',
  label: 'Yappy',
  methods: ['qr'],

  /**
   * Las tres, y ninguna vacía.
   *
   * El dominio hace falta además de las claves: Yappy valida que la petición
   * venga del dominio declarado en el portal, así que unas credenciales buenas
   * con el dominio mal puesto fallan igual que unas malas.
   *
   * Se comprueba que tengan contenido y no solo que existan: una variable sin
   * valor en GitHub Actions llega como cadena vacía y pasa cualquier `??`
   * (ver docs/ESTADO.md § 4).
   */
  isConfigured() {
    return Boolean(
      process.env.YAPPY_MERCHANT_ID?.trim() &&
      process.env.YAPPY_SECRET_KEY?.trim() &&
      process.env.YAPPY_DOMAIN_URL?.trim(),
    );
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

  verifyWebhook(_request: {
    body: string;
    headers: Record<string, string>;
  }): Promise<WebhookVerification> {
    throw new NotImplementedError('yappy', 'verifyWebhook');
  },
};
