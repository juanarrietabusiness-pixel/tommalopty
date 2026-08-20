import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../generated/database.types';

type Client = SupabaseClient<Database>;

export interface DashboardMetrics {
  revenue: number;
  orders_count: number;
  average_order_value: number;
  new_customers: number;
  pending_orders: number;
  low_stock_items: number;
}

const EMPTY_METRICS: DashboardMetrics = {
  revenue: 0,
  orders_count: 0,
  average_order_value: 0,
  new_customers: 0,
  pending_orders: 0,
  low_stock_items: 0,
};

export async function getDashboardMetrics(client: Client, days = 30): Promise<DashboardMetrics> {
  const { data, error } = await client.rpc('dashboard_metrics', { p_days: days });
  if (error) throw error;
  return data?.[0] ?? EMPTY_METRICS;
}

export async function getSalesDaily(client: Client, limit = 30) {
  const { data, error } = await client
    .from('report_sales_daily')
    .select('*')
    .order('day', { ascending: false })
    .limit(limit);

  if (error) throw error;
  // Se devuelve en orden cronológico para pintar el gráfico de izquierda a derecha.
  return (data ?? []).reverse();
}

export async function getTopProducts(client: Client, limit = 10) {
  const { data, error } = await client.from('report_top_products').select('*').limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function getLowStock(client: Client, limit = 20) {
  const { data, error } = await client.from('report_low_stock').select('*').limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function getConversionFunnel(client: Client, limit = 14) {
  const { data, error } = await client
    .from('report_conversion_funnel')
    .select('*')
    .order('day', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []).reverse();
}
