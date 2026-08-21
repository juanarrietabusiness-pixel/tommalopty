import type { Enums, Tables, Views } from '@nebula/db';
import {
  getCustomer,
  getCustomerOrders,
  getDashboardMetrics,
  getOrder,
  getSalesDaily,
  getTopProducts,
  getLowStock,
  getConversionFunnel,
  listCustomerNotes,
  listCustomers,
  listOrderEvents,
  listOrders,
  listPayments,
} from '@nebula/db';
import { getSupabaseServerClient } from './supabase';
import { esModoDemostracion } from './demo-mode';
import * as demo from './demo-data';

/**
 * Capa de lectura del panel.
 *
 * Todas las consultas de las pantallas pasan por aquí, y aquí está la ÚNICA
 * bifurcación entre datos reales y recorrido de demostración. Tenerla en un
 * solo fichero es lo que permite auditarla de un vistazo: si mañana alguien
 * quiere saber dónde puede aparecer un dato inventado, la respuesta es "aquí y
 * en ningún otro sitio".
 *
 * La condición es siempre `esModoDemostracion()`, es decir, que NO haya Supabase
 * configurado. Nunca que una consulta falle: un panel que rellena huecos cuando
 * la base está caída lleva a tomar decisiones sobre cifras que no existen.
 *
 * En producción Supabase está configurado, así que ninguna rama de demostración
 * se ejecuta jamás. El panel desplegado es este mismo.
 */

/* --- Dashboard ------------------------------------------------------------- */

export async function cargarDashboard() {
  if (esModoDemostracion()) {
    return {
      metrics: demo.METRICAS_DEMO,
      sales: demo.VENTAS_DIARIAS_DEMO.map((d) => ({
        day: d.day,
        orders_count: d.orders_count,
        revenue: d.revenue,
        discounts: 0,
        shipping: 0,
        average_order_value: Math.round((d.revenue / Math.max(d.orders_count, 1)) * 100) / 100,
      })),
      lowStock: bajoStockDemo(5),
      recentOrders: { orders: demo.PEDIDOS_DEMO.slice(0, 8), total: demo.PEDIDOS_DEMO.length },
    };
  }

  const supabase = await getSupabaseServerClient();
  const [metrics, sales, lowStock, recentOrders] = await Promise.all([
    getDashboardMetrics(supabase, 30),
    getSalesDaily(supabase, 14),
    getLowStock(supabase, 5),
    listOrders(supabase, { limit: 8 }),
  ]);

  return { metrics, sales, lowStock, recentOrders };
}

/* --- Reportes -------------------------------------------------------------- */

export async function cargarReportes(days: number) {
  if (esModoDemostracion()) {
    return {
      metrics: demo.METRICAS_DEMO,
      sales: demo.VENTAS_DIARIAS_DEMO.map((d) => ({
        day: d.day,
        orders_count: d.orders_count,
        revenue: d.revenue,
        discounts: 0,
        shipping: 0,
        average_order_value: Math.round((d.revenue / Math.max(d.orders_count, 1)) * 100) / 100,
      })),
      topProducts: demo.PRODUCTOS_DEMO.slice(0, 4).map((p, i) => ({
        product_id: p.id,
        title: p.title,
        slug: p.slug,
        units_sold: [48, 31, 22, 14][i] ?? 5,
        revenue: [600, 558, 878, 630][i] ?? 100,
        orders_count: [40, 28, 20, 12][i] ?? 4,
      })),
      lowStock: bajoStockDemo(20),
      funnel: demo.VENTAS_DIARIAS_DEMO.slice(-14).map((d) => ({
        day: d.day,
        carts_created: d.orders_count * 4,
        carts_with_items: d.orders_count * 3,
        carts_converted: d.orders_count,
        carts_abandoned: d.orders_count * 2,
      })),
    };
  }

  const supabase = await getSupabaseServerClient();
  const [metrics, sales, topProducts, lowStock, funnel] = await Promise.all([
    getDashboardMetrics(supabase, days),
    getSalesDaily(supabase, days),
    getTopProducts(supabase, 10),
    getLowStock(supabase, 20),
    getConversionFunnel(supabase, 14),
  ]);

  return { metrics, sales, topProducts, lowStock, funnel };
}

/** Las variantes por debajo de su umbral, con la forma de `report_low_stock`. */
function bajoStockDemo(limite: number): Views<'report_low_stock'>[] {
  return demo.INVENTARIO_DEMO.filter(
    (inv) => inv.quantity - inv.reserved_quantity <= inv.low_stock_threshold,
  )
    .slice(0, limite)
    .map((inv) => {
      const variante = demo.VARIANTES_DEMO.find((v) => v.id === inv.variant_id);
      const producto = demo.PRODUCTOS_DEMO.find((p) => p.id === variante?.product_id);

      return {
        variant_id: inv.variant_id,
        product_id: producto?.id ?? null,
        product_title: producto?.title ?? null,
        variant_title: variante?.title ?? null,
        sku: variante?.sku ?? null,
        quantity: inv.quantity,
        reserved_quantity: inv.reserved_quantity,
        low_stock_threshold: inv.low_stock_threshold,
        available_quantity: Math.max(inv.quantity - inv.reserved_quantity, 0),
      };
    });
}

/* --- Pedidos --------------------------------------------------------------- */

export async function cargarPedidos(options: {
  search?: string;
  status?: Enums<'order_status'>;
  paymentStatus?: Enums<'payment_status'>;
}) {
  if (esModoDemostracion()) {
    const filtrados = demo.PEDIDOS_DEMO.filter((p) => {
      if (options.status && p.status !== options.status) return false;
      if (options.paymentStatus && p.payment_status !== options.paymentStatus) return false;
      if (options.search) {
        const q = options.search.toLowerCase();
        if (!p.order_number.toLowerCase().includes(q) && !p.email.toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    });
    return { orders: filtrados, total: filtrados.length };
  }

  const supabase = await getSupabaseServerClient();
  return listOrders(supabase, { ...options, limit: 50 });
}

export async function cargarPedido(id: string) {
  if (esModoDemostracion()) {
    const pedido = demo.PEDIDOS_DEMO.find((p) => p.id === id);
    if (!pedido) return null;

    return {
      order: { ...pedido, order_items: demo.LINEAS_DEMO.filter((l) => l.order_id === id) },
      events: demo.EVENTOS_DEMO.filter((e) => e.order_id === id),
      payments: demo.PAGOS_DEMO.filter((y) => y.order_id === id),
    };
  }

  const supabase = await getSupabaseServerClient();
  const order = await getOrder(supabase, id);
  if (!order) return null;

  const [events, payments] = await Promise.all([
    listOrderEvents(supabase, id),
    listPayments(supabase, id),
  ]);

  return { order, events, payments };
}

/* --- Clientes / CRM -------------------------------------------------------- */

export async function cargarClientes(options: { search?: string; tag?: string }) {
  if (esModoDemostracion()) {
    const filtrados = demo.CLIENTES_DEMO.filter((c) => {
      if (options.tag && !c.tags.includes(options.tag)) return false;
      if (options.search) {
        const q = options.search.toLowerCase();
        const nombre = `${c.first_name ?? ''} ${c.last_name ?? ''}`.toLowerCase();
        if (!c.email.toLowerCase().includes(q) && !nombre.includes(q)) return false;
      }
      return true;
    });

    return {
      customers: filtrados,
      total: filtrados.length,
      tags: demo.ETIQUETAS_DEMO.map((t) => ({ id: t.id, name: t.name })),
    };
  }

  const supabase = await getSupabaseServerClient();
  const [{ customers, total }, { data: tags }] = await Promise.all([
    listCustomers(supabase, { ...options, limit: 50 }),
    supabase.from('crm_tags').select('id, name'),
  ]);

  return { customers, total, tags: tags ?? [] };
}

export async function cargarCliente(id: string) {
  if (esModoDemostracion()) {
    const customer = demo.CLIENTES_DEMO.find((c) => c.id === id);
    if (!customer) return null;

    return {
      customer,
      orders: demo.PEDIDOS_DEMO.filter((p) => p.customer_id === id),
      notes: demo.NOTAS_DEMO.filter((n) => n.customer_id === id),
    };
  }

  const supabase = await getSupabaseServerClient();
  const customer = await getCustomer(supabase, id);
  if (!customer) return null;

  const [orders, notes] = await Promise.all([
    getCustomerOrders(supabase, id),
    listCustomerNotes(supabase, id),
  ]);

  return { customer, orders, notes };
}

/* --- Catálogo -------------------------------------------------------------- */

/** Fila del listado de catálogo, con variante por defecto e inventario ya resueltos. */
export interface FilaCatalogo {
  id: string;
  title: string;
  slug: string;
  status: Enums<'product_status'>;
  is_featured: boolean;
  price: number | null;
  sku: string | null;
  stock: number;
}

export async function cargarCatalogo(options: {
  search?: string;
  status?: Enums<'product_status'>;
}): Promise<FilaCatalogo[]> {
  if (esModoDemostracion()) {
    return demo.PRODUCTOS_DEMO.filter((p) => {
      if (options.status && p.status !== options.status) return false;
      if (options.search && !p.title.toLowerCase().includes(options.search.toLowerCase())) {
        return false;
      }
      return true;
    }).map((p) => {
      const variante = demo.VARIANTES_DEMO.find((v) => v.product_id === p.id);
      const inv = demo.INVENTARIO_DEMO.find((i) => i.variant_id === variante?.id);

      return {
        id: p.id,
        title: p.title,
        slug: p.slug,
        status: p.status,
        is_featured: p.is_featured,
        price: variante?.price ?? null,
        sku: variante?.sku ?? null,
        stock: inv ? Math.max(inv.quantity - inv.reserved_quantity, 0) : 0,
      };
    });
  }

  const supabase = await getSupabaseServerClient();
  let query = supabase
    .from('products')
    .select(
      'id, title, slug, status, is_featured, product_variants (price, sku, is_default, inventory (quantity, reserved_quantity))',
    )
    .order('created_at', { ascending: false })
    .limit(100);

  if (options.search) query = query.ilike('title', `%${options.search}%`);
  if (options.status) query = query.eq('status', options.status);

  const { data } = await query;

  return (data ?? []).map((product) => {
    const variant =
      product.product_variants?.find((candidate) => candidate.is_default) ??
      product.product_variants?.[0];
    const inventory = Array.isArray(variant?.inventory)
      ? variant?.inventory[0]
      : variant?.inventory;

    return {
      id: product.id,
      title: product.title,
      slug: product.slug,
      status: product.status,
      is_featured: product.is_featured,
      price: variant?.price ?? null,
      sku: variant?.sku ?? null,
      stock: Math.max((inventory?.quantity ?? 0) - (inventory?.reserved_quantity ?? 0), 0),
    };
  });
}

/** Producto para el formulario de edición, con su variante por defecto. */
export interface ProductoEditable {
  id: string;
  title: string;
  slug: string;
  subtitle: string | null;
  description: string | null;
  brand: string | null;
  status: Enums<'product_status'>;
  isFeatured: boolean;
  tags: string[];
  seoTitle: string | null;
  seoDescription: string | null;
  price: number | null;
  compareAtPrice: number | null;
  sku: string | null;
  quantity: number | null;
}

export async function cargarProducto(id: string): Promise<ProductoEditable | null> {
  if (esModoDemostracion()) {
    const p = demo.PRODUCTOS_DEMO.find((x) => x.id === id);
    if (!p) return null;

    const variante = demo.VARIANTES_DEMO.find((v) => v.product_id === p.id);
    const inv = demo.INVENTARIO_DEMO.find((i) => i.variant_id === variante?.id);

    return {
      id: p.id,
      title: p.title,
      slug: p.slug,
      subtitle: p.subtitle,
      description: p.description,
      brand: p.brand,
      status: p.status,
      isFeatured: p.is_featured,
      tags: p.tags,
      seoTitle: p.seo_title,
      seoDescription: p.seo_description,
      price: variante?.price ?? null,
      compareAtPrice: variante?.compare_at_price ?? null,
      sku: variante?.sku ?? null,
      quantity: inv?.quantity ?? null,
    };
  }

  const supabase = await getSupabaseServerClient();
  const { data: product } = await supabase
    .from('products')
    .select(
      `id, title, slug, subtitle, description, brand, status, is_featured, tags,
       seo_title, seo_description,
       product_variants (id, price, compare_at_price, sku, is_default,
         inventory (quantity))`,
    )
    .eq('id', id)
    .maybeSingle();

  if (!product) return null;

  const variant =
    product.product_variants?.find((candidate) => candidate.is_default) ??
    product.product_variants?.[0];
  const inventory = Array.isArray(variant?.inventory) ? variant?.inventory[0] : variant?.inventory;

  return {
    id: product.id,
    title: product.title,
    slug: product.slug,
    subtitle: product.subtitle,
    description: product.description,
    brand: product.brand,
    status: product.status,
    isFeatured: product.is_featured,
    tags: product.tags,
    seoTitle: product.seo_title,
    seoDescription: product.seo_description,
    price: variant?.price ?? null,
    compareAtPrice: variant?.compare_at_price ?? null,
    sku: variant?.sku ?? null,
    quantity: inventory?.quantity ?? null,
  };
}

export interface FilaCategoria {
  id: string;
  name: string;
  slug: string;
  position: number;
  isActive: boolean;
  productCount: number;
}

export async function cargarCategorias(): Promise<FilaCategoria[]> {
  if (esModoDemostracion()) {
    return demo.CATEGORIAS_DEMO.map((c, i) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      position: c.position,
      isActive: c.is_active,
      productCount: [3, 2, 0][i] ?? 0,
    }));
  }

  const supabase = await getSupabaseServerClient();
  const { data: categories } = await supabase
    .from('categories')
    .select('id, name, slug, description, position, is_active, product_categories (product_id)')
    .order('position');

  return (categories ?? []).map((category) => ({
    id: category.id,
    name: category.name,
    slug: category.slug,
    position: category.position,
    isActive: category.is_active,
    productCount: category.product_categories?.length ?? 0,
  }));
}

export interface FilaInventario {
  variantId: string;
  productTitle: string;
  variantTitle: string;
  sku: string | null;
  quantity: number;
  reserved: number;
  available: number;
  threshold: number;
}

export async function cargarInventario(): Promise<FilaInventario[]> {
  if (esModoDemostracion()) {
    return demo.INVENTARIO_DEMO.map((inv) => {
      const variante = demo.VARIANTES_DEMO.find((v) => v.id === inv.variant_id);
      const producto = demo.PRODUCTOS_DEMO.find((p) => p.id === variante?.product_id);

      return {
        variantId: inv.variant_id,
        productTitle: producto?.title ?? 'Producto',
        variantTitle: variante?.title ?? 'Estándar',
        sku: variante?.sku ?? null,
        quantity: inv.quantity,
        reserved: inv.reserved_quantity,
        available: Math.max(inv.quantity - inv.reserved_quantity, 0),
        threshold: inv.low_stock_threshold,
      };
    }).sort((a, b) => a.quantity - b.quantity);
  }

  const supabase = await getSupabaseServerClient();
  const { data } = await supabase
    .from('inventory')
    .select(
      'variant_id, quantity, reserved_quantity, low_stock_threshold, product_variants (title, sku, products (title))',
    )
    .order('quantity')
    .limit(200);

  return (data ?? []).map((entry) => {
    const variant = Array.isArray(entry.product_variants)
      ? entry.product_variants[0]
      : entry.product_variants;
    const product = Array.isArray(variant?.products) ? variant?.products[0] : variant?.products;

    return {
      variantId: entry.variant_id,
      productTitle: product?.title ?? 'Producto',
      variantTitle: variant?.title ?? 'Estándar',
      sku: variant?.sku ?? null,
      quantity: entry.quantity,
      reserved: entry.reserved_quantity,
      available: Math.max(entry.quantity - entry.reserved_quantity, 0),
      threshold: entry.low_stock_threshold,
    };
  });
}

/* --- Descuentos ------------------------------------------------------------ */

export async function cargarDescuentos(): Promise<Tables<'discounts'>[]> {
  if (esModoDemostracion()) return demo.DESCUENTOS_DEMO;

  const supabase = await getSupabaseServerClient();
  const { data } = await supabase
    .from('discounts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  return data ?? [];
}

/* --- Contenido ------------------------------------------------------------- */

export async function cargarBanners(placements: readonly string[]) {
  if (esModoDemostracion()) {
    return demo.BANNERS_DEMO.filter((b) => placements.includes(b.placement));
  }

  const supabase = await getSupabaseServerClient();
  const { data } = await supabase
    .from('cms_banners')
    .select('*')
    .in('placement', placements as string[])
    .order('position');

  return data ?? [];
}

export interface ResumenPagina {
  id: string;
  title: string;
  slug: string;
  status: Enums<'content_status'>;
  updated_at: string;
}

export async function cargarPaginas(): Promise<ResumenPagina[]> {
  if (esModoDemostracion()) {
    return demo.PAGINAS_DEMO.map((p) => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      status: p.status,
      updated_at: p.updated_at,
    })).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }

  const supabase = await getSupabaseServerClient();
  const { data } = await supabase
    .from('cms_pages')
    .select('id, title, slug, status, updated_at')
    .order('updated_at', { ascending: false });

  return data ?? [];
}

export async function cargarPagina(id: string): Promise<Tables<'cms_pages'> | null> {
  if (esModoDemostracion()) {
    return demo.PAGINAS_DEMO.find((p) => p.id === id) ?? null;
  }

  const supabase = await getSupabaseServerClient();
  const { data } = await supabase.from('cms_pages').select('*').eq('id', id).maybeSingle();
  return data;
}

/* --- Administración -------------------------------------------------------- */

export async function cargarIntegraciones(): Promise<Tables<'integrations'>[]> {
  if (esModoDemostracion()) return demo.INTEGRACIONES_DEMO;

  const supabase = await getSupabaseServerClient();
  const { data } = await supabase.from('integrations').select('*').order('provider');
  return data ?? [];
}

export interface FilaUsuario {
  id: string;
  email: string;
  full_name: string | null;
  role: Enums<'user_role'>;
  is_active: boolean;
  created_at: string;
}

export async function cargarUsuarios(): Promise<FilaUsuario[]> {
  if (esModoDemostracion()) {
    return demo.PERFILES_DEMO.map((p) => ({
      id: p.id,
      email: p.email,
      full_name: p.full_name,
      role: p.role,
      is_active: p.is_active,
      created_at: p.created_at,
    }));
  }

  const supabase = await getSupabaseServerClient();
  // RLS solo deja ver la lista completa a un superadmin; un admin verá su perfil.
  const { data } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, is_active, created_at')
    .order('role')
    .order('created_at', { ascending: false });

  return data ?? [];
}
