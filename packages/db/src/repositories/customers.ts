import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Tables } from '../generated/database.types';

type Client = SupabaseClient<Database>;

export type Customer = Tables<'customers'>;
export type CrmNote = Tables<'crm_notes'>;

export interface ListCustomersOptions {
  search?: string;
  tag?: string;
  limit?: number;
  offset?: number;
}

export async function listCustomers(
  client: Client,
  options: ListCustomersOptions = {},
): Promise<{ customers: Customer[]; total: number }> {
  const { limit = 25, offset = 0 } = options;

  let query = client
    .from('customers')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false });

  if (options.search) {
    query = query.or(
      `email.ilike.%${options.search}%,first_name.ilike.%${options.search}%,last_name.ilike.%${options.search}%`,
    );
  }
  if (options.tag) query = query.contains('tags', [options.tag]);

  const { data, error, count } = await query.range(offset, offset + limit - 1);
  if (error) throw error;

  return { customers: data ?? [], total: count ?? 0 };
}

export async function getCustomer(client: Client, id: string): Promise<Customer | null> {
  const { data, error } = await client.from('customers').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getCustomerOrders(client: Client, customerId: string) {
  const { data, error } = await client
    .from('orders')
    .select('id, order_number, status, payment_status, total, placed_at, created_at')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function listCustomerNotes(client: Client, customerId: string): Promise<CrmNote[]> {
  const { data, error } = await client
    .from('crm_notes')
    .select('*')
    .eq('customer_id', customerId)
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/** Ficha del cliente autenticado (panel de cliente). */
export async function getMyCustomer(client: Client): Promise<Customer | null> {
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return null;

  const { data, error } = await client
    .from('customers')
    .select('*')
    .eq('profile_id', user.id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function listMyAddresses(client: Client) {
  const { data, error } = await client
    .from('addresses')
    .select('*')
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}
