/** El adaptador existe pero su integración todavía no está implementada. */
export class NotImplementedError extends Error {
  readonly provider: string;

  constructor(provider: string, operation: string) {
    super(
      `[${provider}] "${operation}" aún no está implementado. ` +
        `Ver packages/integrations/README.md para los pasos pendientes.`,
    );
    this.name = 'NotImplementedError';
    this.provider = provider;
  }
}

/** Fallo de negocio devuelto por la pasarela (rechazo, importe inválido…). */
export class PaymentError extends Error {
  readonly provider: string;
  readonly code: string;

  constructor(provider: string, code: string, message: string) {
    super(message);
    this.name = 'PaymentError';
    this.provider = provider;
    this.code = code;
  }
}
