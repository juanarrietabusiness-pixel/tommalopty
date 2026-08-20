import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import { connect, isDatabaseAvailable } from './helpers';

/**
 * Reservas de stock y permisos de creación de pedidos, contra Postgres real.
 *
 * Lo que se verifica aquí no son políticas RLS sino reglas con consecuencia
 * comercial directa: un pedido que nadie paga no puede retener inventario para
 * siempre —el catálogo se marca "agotado" solo y la tienda deja de vender sin
 * haber vendido nada— y el servidor tiene que poder crear pedidos, que es de lo
 * que depende el checkout entero.
 */

const EMAIL = 'reservas@test.local';
const CUPON = 'RESERVASTEST';

let client: Client;

const available = await isDatabaseAvailable();
const describeIfDb = available ? describe : describe.skip;

if (!available) {
  console.warn(
    '[reservas] Sin base de datos disponible: se omiten los tests de caducidad. ' +
      'Levántala con `pnpm db:start` o define TEST_DATABASE_URL.',
  );
}

beforeAll(async () => {
  if (!available) return;
  client = await connect();
  await cleanup(client);
}, 30_000);

afterAll(async () => {
  if (!available || !client) return;
  await cleanup(client);
  await client.end();
});

async function cleanup(db: Client): Promise<void> {
  await db.query(`delete from public.orders where email like '%@test.local'`);
  await db.query(`delete from public.customers where email like '%@test.local'`);
  await db.query(`delete from public.products where slug like 'reservas-%'`);
  await db.query(`delete from public.discounts where code = $1`, [CUPON]);
}

/** Deja una variante publicada con stock y devuelve su id. */
async function crearVarianteConStock(db: Client, unidades: number): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `with p as (
       insert into public.products (slug, title, status, published_at)
       values ('reservas-producto', 'Producto de reservas', 'active', now())
       returning id
     ), v as (
       insert into public.product_variants (product_id, title, price, is_default)
       select id, 'Estándar', 25.00, true from p
       returning id
     )
     insert into public.inventory (variant_id, quantity, reserved_quantity, track_inventory)
     select id, $1, 0, true from v
     returning variant_id as id`,
    [unidades],
  );
  return rows[0]!.id;
}

async function reservadas(db: Client, variantId: string): Promise<number> {
  const { rows } = await db.query<{ reserved_quantity: number }>(
    `select reserved_quantity from public.inventory where variant_id = $1`,
    [variantId],
  );
  return rows[0]?.reserved_quantity ?? -1;
}

/** Envejece un pedido para que la caducidad lo alcance. */
async function envejecer(db: Client, orderId: string, horas: number): Promise<void> {
  await db.query(
    `update public.orders set created_at = now() - make_interval(hours => $2) where id = $1`,
    [orderId, horas],
  );
}

async function crearPedido(db: Client, variantId: string, cantidad: number, cupon?: string) {
  const { rows } = await db.query<{ order_id: string }>(
    `select order_id from public.create_order($1, $2::jsonb, null, null, $3::text)`,
    [EMAIL, JSON.stringify([{ variant_id: variantId, quantity: cantidad }]), cupon ?? null],
  );
  return rows[0]!.order_id;
}

describeIfDb('caducidad de las reservas de stock', () => {
  it('libera la reserva de un pedido que nadie pagó', async () => {
    const variantId = await crearVarianteConStock(client, 10);
    const orderId = await crearPedido(client, variantId, 3);

    expect(await reservadas(client, variantId)).toBe(3);

    await envejecer(client, orderId, 5);
    const { rows } = await client.query<{ caducados: number }>(
      `select public.caducar_reservas_de_pedidos(2) as caducados`,
    );

    expect(rows[0]!.caducados).toBe(1);
    expect(await reservadas(client, variantId)).toBe(0);

    const { rows: pedido } = await client.query<{ status: string; cancelled_reason: string }>(
      `select status, cancelled_reason from public.orders where id = $1`,
      [orderId],
    );
    expect(pedido[0]!.status).toBe('cancelled');
    expect(pedido[0]!.cancelled_reason).toContain('Reserva caducada');

    await cleanup(client);
  });

  it('no toca un pedido reciente: el cliente todavía está pagando', async () => {
    const variantId = await crearVarianteConStock(client, 10);
    await crearPedido(client, variantId, 2);

    const { rows } = await client.query<{ caducados: number }>(
      `select public.caducar_reservas_de_pedidos(2) as caducados`,
    );

    expect(rows[0]!.caducados).toBe(0);
    expect(await reservadas(client, variantId)).toBe(2);

    await cleanup(client);
  });

  it('no cancela un pedido ya pagado por muy antiguo que sea', async () => {
    // El caso que se cobra caro: el webhook confirma el pago de un pedido viejo
    // y la caducidad no puede llevárselo por delante.
    const variantId = await crearVarianteConStock(client, 10);
    const orderId = await crearPedido(client, variantId, 4);

    await client.query(`update public.orders set payment_status = 'paid' where id = $1`, [orderId]);
    await envejecer(client, orderId, 48);

    const { rows } = await client.query<{ caducados: number }>(
      `select public.caducar_reservas_de_pedidos(2) as caducados`,
    );

    expect(rows[0]!.caducados).toBe(0);
    expect(await reservadas(client, variantId)).toBe(4);

    await cleanup(client);
  });

  it('devuelve el uso del cupón: un carrito abandonado no lo quema', async () => {
    const variantId = await crearVarianteConStock(client, 10);
    await client.query(
      `insert into public.discounts (code, type, value, usage_limit) values ($1, 'percentage', 10, 1)`,
      [CUPON],
    );

    const orderId = await crearPedido(client, variantId, 1, CUPON);

    const usados = async () => {
      const { rows } = await client.query<{ usage_count: number; canjes: string }>(
        `select d.usage_count,
                (select count(*) from public.discount_redemptions r where r.discount_id = d.id)::text as canjes
         from public.discounts d where d.code = $1`,
        [CUPON],
      );
      return { usos: rows[0]!.usage_count, canjes: Number(rows[0]!.canjes) };
    };

    expect(await usados()).toEqual({ usos: 1, canjes: 1 });

    await envejecer(client, orderId, 5);
    await client.query(`select public.caducar_reservas_de_pedidos(2)`);

    expect(await usados()).toEqual({ usos: 0, canjes: 0 });

    await cleanup(client);
  });

  it('rechaza un plazo absurdo en lugar de cancelar pedidos recién creados', async () => {
    await expect(client.query(`select public.caducar_reservas_de_pedidos(0)`)).rejects.toThrow(
      /al menos una hora/,
    );
  });

  it('no es invocable desde el navegador', async () => {
    // Misma lección que `create_order`: PostgREST expone las funciones de
    // `public` en /rest/v1/rpc/, y un `create or replace` futuro reconcede
    // EXECUTE a PUBLIC en silencio.
    for (const role of ['anon', 'authenticated'] as const) {
      await client.query('begin');
      try {
        await client.query(`set local role ${role}`);
        await expect(
          client.query(`select public.caducar_reservas_de_pedidos(2)`),
        ).rejects.toMatchObject({ code: '42501' });
      } finally {
        await client.query('rollback');
      }
    }
  });

  it('el servidor sí puede ejecutarla', async () => {
    // La otra mitad del permiso. Revocar de PUBLIC deja EXECUTE solo al
    // propietario, así que sin el `grant` explícito a service_role la función
    // queda inservible desde fuera de la base. Es exactamente lo que le pasó a
    // `create_order` en la 0014, y solo se vio al probar el camino bueno.
    await client.query('begin');
    try {
      await client.query('set local role service_role');
      const { rows } = await client.query<{ caducados: number }>(
        `select public.caducar_reservas_de_pedidos(2) as caducados`,
      );
      expect(typeof rows[0]!.caducados).toBe('number');
    } finally {
      await client.query('rollback');
    }
  });
});

describeIfDb('quién puede crear pedidos', () => {
  it('el servidor sí puede: de esto depende el checkout entero', async () => {
    // `create_order` tiene el EXECUTE revocado de PUBLIC, anon y authenticated.
    // Que service_role lo conserve no es evidente: depende de que la concesión
    // que Supabase le da por ALTER DEFAULT PRIVILEGES sobreviva a ese revoke.
    // Si algún día no sobrevive, el primer pedido real devuelve 500 y nadie se
    // entera hasta que un cliente lo intenta. Por eso se comprueba el camino
    // bueno, no solo los malos.
    const variantId = await crearVarianteConStock(client, 10);

    await client.query('begin');
    try {
      await client.query('set local role service_role');
      const { rows } = await client.query<{ order_id: string }>(
        `select order_id from public.create_order($1, $2::jsonb)`,
        [EMAIL, JSON.stringify([{ variant_id: variantId, quantity: 1 }])],
      );
      expect(rows[0]?.order_id).toBeTruthy();
    } finally {
      await client.query('rollback');
    }

    await cleanup(client);
  });
});
