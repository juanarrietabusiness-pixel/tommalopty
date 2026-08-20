/**
 * Traduce los enums de la base de datos a etiquetas en español con color.
 * Mantener sincronizado con los tipos de `packages/db`.
 */
type Tone = 'default' | 'success' | 'warning' | 'danger' | 'accent' | 'dark';

const ORDER_STATUS: Record<string, { label: string; tone: Tone }> = {
  pending: { label: 'Pendiente', tone: 'warning' },
  confirmed: { label: 'Confirmado', tone: 'default' },
  processing: { label: 'En preparación', tone: 'default' },
  shipped: { label: 'Enviado', tone: 'dark' },
  delivered: { label: 'Entregado', tone: 'success' },
  cancelled: { label: 'Cancelado', tone: 'danger' },
  refunded: { label: 'Reembolsado', tone: 'danger' },
};

const PAYMENT_STATUS: Record<string, { label: string; tone: Tone }> = {
  pending: { label: 'Pago pendiente', tone: 'warning' },
  authorized: { label: 'Autorizado', tone: 'default' },
  paid: { label: 'Pagado', tone: 'success' },
  partially_refunded: { label: 'Reembolso parcial', tone: 'warning' },
  refunded: { label: 'Reembolsado', tone: 'danger' },
  failed: { label: 'Fallido', tone: 'danger' },
  cancelled: { label: 'Cancelado', tone: 'danger' },
};

const FULFILLMENT_STATUS: Record<string, { label: string; tone: Tone }> = {
  unfulfilled: { label: 'Sin preparar', tone: 'warning' },
  partial: { label: 'Parcial', tone: 'warning' },
  fulfilled: { label: 'Preparado', tone: 'success' },
  returned: { label: 'Devuelto', tone: 'danger' },
};

const CONTENT_STATUS: Record<string, { label: string; tone: Tone }> = {
  draft: { label: 'Borrador', tone: 'default' },
  published: { label: 'Publicado', tone: 'success' },
  archived: { label: 'Archivado', tone: 'default' },
  active: { label: 'Activo', tone: 'success' },
};

const MAPS = {
  order: ORDER_STATUS,
  payment: PAYMENT_STATUS,
  fulfillment: FULFILLMENT_STATUS,
  content: CONTENT_STATUS,
} as const;

const TONE_CLASS: Record<Tone, string> = {
  default: 'tag',
  success: 'tag tag-success',
  warning: 'tag tag-warning',
  danger: 'tag tag-danger',
  accent: 'tag tag-accent',
  dark: 'tag tag-dark',
};

export function StatusBadge({
  kind,
  value,
}: {
  kind: keyof typeof MAPS;
  value: string | null | undefined;
}) {
  if (!value) return <span className="tag">—</span>;
  const entry = MAPS[kind][value] ?? { label: value, tone: 'default' as Tone };
  return <span className={TONE_CLASS[entry.tone]}>{entry.label}</span>;
}
