import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Enums, Tables } from '../generated/database.types';

type Client = SupabaseClient<Database>;

export type Order = Tables<'orders'>;
export type OrderItem = Tables<'order_items'>;

export interface OrderWithItems extends Order {
  order_items: OrderItem[];
}

export interface ListOrdersOptions {
  status?: Enums<'order_status'>;
  paymentStatus?: Enums<'payment_status'>;
  search?: string;
  limit?: number;
  offset?: number;
}

/** Listado para el panel. RLS restringe el acceso a staff. */
export async function listOrders(
  client: Client,
  options: ListOrdersOptions = {},
): Promise<{ orders: Order[]; total: number }> {
  const { limit = 25, offset = 0 } = options;

  let query = client
    .from('orders')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false });

  if (options.status) query = query.eq('status', options.status);
  if (options.paymentStatus) query = query.eq('payment_status', options.paymentStatus);
  if (options.search) {
    query = query.or(`order_number.ilike.%${options.search}%,email.ilike.%${options.search}%`);
  }

  const { data, error, count } = await query.range(offset, offset + limit - 1);
  if (error) throw error;

  return { orders: data ?? [], total: count ?? 0 };
}

export async function getOrder(client: Client, id: string): Promise<OrderWithItems | null> {
  const { data, error } = await client
    .from('orders')
    .select('*, order_items (*)')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data as OrderWithItems | null;
}

export async function getOrderByNumber(
  client: Client,
  orderNumber: string,
): Promise<OrderWithItems | null> {
  const { data, error } = await client
    .from('orders')
    .select('*, order_items (*)')
    .eq('order_number', orderNumber)
    .maybeSingle();

  if (error) throw error;
  return data as OrderWithItems | null;
}

/** Pedidos del cliente autenticado (panel de cliente). RLS hace el filtrado. */
export async function listMyOrders(client: Client, limit = 20): Promise<OrderWithItems[]> {
  const { data, error } = await client
    .from('orders')
    .select('*, order_items (*)')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as OrderWithItems[];
}

export async function listOrderEvents(client: Client, orderId: string) {
  const { data, error } = await client
    .from('order_events')
    .select('id, type, message, created_at')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function listPayments(client: Client, orderId: string) {
  const { data, error } = await client
    .from('payments')
    .select(
      'id, provider, provider_payment_id, reference, receipt_key, status, amount, currency, error_message, created_at',
    )
    .eq('order_id', orderId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}
