/**
 * Eventos estándar de Meta usados por la tienda.
 * El mismo evento se dispara en cliente (Pixel) y en servidor (Conversions API)
 * compartiendo `event_id`, para que Meta los deduplique.
 */
export const META_EVENTS = {
  pageView: 'PageView',
  viewContent: 'ViewContent',
  addToCart: 'AddToCart',
  initiateCheckout: 'InitiateCheckout',
  addPaymentInfo: 'AddPaymentInfo',
  purchase: 'Purchase',
  lead: 'Lead',
  search: 'Search',
} as const;

export type MetaEventName = (typeof META_EVENTS)[keyof typeof META_EVENTS];

export interface MetaContent {
  id: string;
  quantity: number;
  itemPrice: number;
  title?: string;
}

export interface MetaCustomData {
  currency?: string;
  value?: number;
  contents?: MetaContent[];
  contentType?: 'product' | 'product_group';
  orderId?: string;
  searchString?: string;
}

/**
 * `event_id` compartido entre Pixel y CAPI. Debe generarse una sola vez por
 * acción del usuario y enviarse por ambos canales.
 */
export function createEventId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function buildCustomData(data: MetaCustomData): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  if (data.currency) payload.currency = data.currency;
  if (typeof data.value === 'number') payload.value = Number(data.value.toFixed(2));
  if (data.contentType) payload.content_type = data.contentType;
  if (data.orderId) payload.order_id = data.orderId;
  if (data.searchString) payload.search_string = data.searchString;

  if (data.contents?.length) {
    payload.contents = data.contents.map((content) => ({
      id: content.id,
      quantity: content.quantity,
      item_price: content.itemPrice,
    }));
    payload.content_ids = data.contents.map((content) => content.id);
  }

  return payload;
}
