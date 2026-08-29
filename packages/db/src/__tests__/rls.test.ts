import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import { asRole, connect, countVisible, isDatabaseAvailable, isWriteBlocked } from './helpers';

/**
 * Verificación de Row Level Security contra Postgres real.
 *
 * Estas pruebas son la red de seguridad de todo el proyecto: comprueban que un
 * visitante no ve pedidos ajenos, que un cliente solo ve los suyos, y que un
 * operador no puede escribir donde no debe. Si alguna falla, hay una fuga de
 * datos — no un test frágil.
 */

const CLIENTE_A = '11111111-1111-1111-1111-111111111111';
const CLIENTE_B = '22222222-2222-2222-2222-222222222222';
const OPERADOR = '33333333-3333-3333-3333-333333333333';
const ADMIN = '44444444-4444-4444-4444-444444444444';

let client: Client;

// La comprobación va en el nivel superior del módulo, no en `beforeAll`: Vitest
// decide qué bloques registrar durante la recolección, que ocurre antes de los
// hooks. Sin base de datos los tests se marcan como omitidos, para que
// `pnpm test` funcione en un portátil sin Docker; en CI la base siempre está.
const available = await isDatabaseAvailable();
const describeIfDb = available ? describe : describe.skip;

if (!available) {
  console.warn(
    '[rls] Sin base de datos disponible: se omiten los tests de RLS. ' +
      'Levántala con `pnpm db:start` o define TEST_DATABASE_URL.',
  );
}

beforeAll(async () => {
  if (!available) return;

  client = await connect();
  await cleanup(client);

  // Fixtures. Se crean una vez y persisten; cada test corre en su transacción.
  await client.query('begin');
  await client.query(
    `insert into auth.users (id, email, raw_user_meta_data) values
       ($1, 'clientea@test.local', '{"full_name":"Cliente A"}'),
       ($2, 'clienteb@test.local', '{"full_name":"Cliente B"}'),
       ($3, 'operador@test.local', '{"full_name":"Operador"}'),
       ($4, 'admin@test.local',    '{"full_name":"Admin"}')
     on conflict (id) do nothing`,
    [CLIENTE_A, CLIENTE_B, OPERADOR, ADMIN],
  );

  await client.query(`update public.profiles set role = 'operator' where id = $1`, [OPERADOR]);
  await client.query(`update public.profiles set role = 'admin' where id = $1`, [ADMIN]);

  // Un producto publicado y uno en borrador.
  await client.query(
    `insert into public.products (slug, title, status) values
       ('rls-publicado', 'Producto publicado RLS', 'active'),
       ('rls-borrador', 'Producto borrador RLS', 'draft')
     on conflict (slug) do nothing`,
  );

  // Un pedido para cada cliente.
  for (const profileId of [CLIENTE_A, CLIENTE_B]) {
    await client.query(
      `insert into public.orders (customer_id, email, subtotal, total, placed_at)
       select c.id, c.email, 50, 50, now()
       from public.customers c where c.profile_id = $1`,
      [profileId],
    );
  }

  // Un descuento y una nota interna que nadie de fuera debería ver.
  await client.query(
    `insert into public.discounts (code, type, value) values ('RLSSECRETO', 'percentage', 20)
     on conflict (code) do nothing`,
  );
  await client.query(
    `insert into public.crm_notes (customer_id, body)
     select c.id, 'Nota interna que el cliente no debe leer'
     from public.customers c where c.profile_id = $1`,
    [CLIENTE_A],
  );

  // Una etiqueta de CRM para comprobar quién puede tocarla.
  await client.query(
    `insert into public.crm_tags (name, color) values ('rls-etiqueta', '#173c2e')
     on conflict (name) do nothing`,
  );

  await client.query('commit');
}, 30_000);

afterAll(async () => {
  if (!available || !client) return;
  await cleanup(client);
  await client.end();
});

/**
 * Borra los datos de prueba en el orden correcto.
 *
 * Importante: `orders.customer_id` es ON DELETE SET NULL, así que borrar el
 * usuario NO borra sus pedidos — los deja huérfanos y la siguiente ejecución
 * contaría de más. Hay que borrarlos explícitamente.
 */
async function cleanup(db: Client): Promise<void> {
  await db.query(`delete from public.orders where email like '%@test.local'`);
  await db.query(`delete from public.customers where email like '%@test.local'`);
  await db.query(`delete from auth.users where email like '%@test.local'`);
  await db.query(`delete from public.products where slug like 'rls-%'`);
  await db.query(`delete from public.discounts where code = 'RLSSECRETO'`);
  await db.query(`delete from public.leads where source = 'rls-test'`);
  await db.query(`delete from public.crm_tags where name = 'rls-etiqueta'`);
}

describeIfDb('visitante anónimo', () => {
  it('ve el catálogo publicado pero no los borradores', async () => {
    await asRole(client, { role: 'anon' }, async (db) => {
      const { rows } = await db.query<{ slug: string }>(
        `select slug from public.products where slug like 'rls-%'`,
      );
      expect(rows.map((r) => r.slug)).toEqual(['rls-publicado']);
    });
  });

  it('no ve ningún pedido', async () => {
    await asRole(client, { role: 'anon' }, async (db) => {
      expect(await countVisible(db, 'public.orders')).toBe(0);
    });
  });

  it('no ve fichas de cliente', async () => {
    await asRole(client, { role: 'anon' }, async (db) => {
      expect(await countVisible(db, 'public.customers')).toBe(0);
    });
  });

  it('no puede enumerar códigos de descuento', async () => {
    await asRole(client, { role: 'anon' }, async (db) => {
      expect(await countVisible(db, 'public.discounts')).toBe(0);
    });
  });

  it('pero sí puede validar un código que ya conoce', async () => {
    await asRole(client, { role: 'anon' }, async (db) => {
      const { rows } = await db.query<{ is_valid: boolean; amount: string }>(
        `select is_valid, amount from public.validate_discount('RLSSECRETO', 100)`,
      );
      expect(rows[0]?.is_valid).toBe(true);
      expect(Number(rows[0]?.amount)).toBe(20);
    });
  });

  it('no ve notas internas del CRM', async () => {
    await asRole(client, { role: 'anon' }, async (db) => {
      expect(await countVisible(db, 'public.crm_notes')).toBe(0);
    });
  });

  it('no puede crear productos', async () => {
    await asRole(client, { role: 'anon' }, async (db) => {
      const blocked = await isWriteBlocked(
        db,
        `insert into public.products (slug, title, status) values ('rls-hackeado', 'Hackeado', 'active')`,
      );
      expect(blocked).toBe(true);
    });
  });

  it('no puede crear pedidos saltándose el servidor', async () => {
    // `create_order` es SECURITY DEFINER y PostgREST la expone en /rest/v1/rpc/.
    // Si el EXECUTE de PUBLIC vuelve (un `create or replace` lo reconcede en
    // silencio), cualquiera con la anon key reserva stock a voluntad.
    await asRole(client, { role: 'anon' }, async (db) => {
      const blocked = await isWriteBlocked(
        db,
        `select * from public.create_order('colado@test.local', '[]'::jsonb)`,
      );
      expect(blocked).toBe(true);
    });
  });

  it('sí puede suscribirse a la newsletter', async () => {
    await asRole(client, { role: 'anon' }, async (db) => {
      const blocked = await isWriteBlocked(
        db,
        `insert into public.leads (email, source) values ('visitante@test.local', 'rls-test')`,
      );
      expect(blocked).toBe(false);
    });
  });
});

describeIfDb('cliente autenticado', () => {
  it('ve sus pedidos y solo los suyos', async () => {
    const total = await asRole(client, { role: 'authenticated', userId: CLIENTE_A }, (db) =>
      countVisible(db, 'public.orders'),
    );
    expect(total).toBe(1);
  });

  it('no ve el pedido del otro cliente ni conociendo su id', async () => {
    // Se obtiene el id del pedido ajeno con permisos totales…
    const { rows } = await client.query<{ id: string }>(
      `select o.id from public.orders o
       join public.customers c on c.id = o.customer_id
       where c.profile_id = $1`,
      [CLIENTE_B],
    );
    const pedidoAjeno = rows[0]?.id;
    expect(pedidoAjeno).toBeTruthy();

    // …y se intenta leerlo directamente como el cliente A.
    await asRole(client, { role: 'authenticated', userId: CLIENTE_A }, async (db) => {
      const result = await db.query(`select id from public.orders where id = $1`, [pedidoAjeno]);
      expect(result.rowCount).toBe(0);
    });
  });

  it('solo ve su propia ficha de cliente', async () => {
    const total = await asRole(client, { role: 'authenticated', userId: CLIENTE_A }, (db) =>
      countVisible(db, 'public.customers'),
    );
    expect(total).toBe(1);
  });

  it('nunca ve las notas internas que el equipo escribió sobre él', async () => {
    const total = await asRole(client, { role: 'authenticated', userId: CLIENTE_A }, (db) =>
      countVisible(db, 'public.crm_notes'),
    );
    expect(total).toBe(0);
  });

  // Regresión: esta escalada de privilegios era posible y la corrigió la
  // migración 20260820120000. RLS es a nivel de fila, no de columna, así que la
  // política de "editar mi propio perfil" incluía la columna `role`.
  it('no puede ascenderse a administrador', async () => {
    await asRole(client, { role: 'authenticated', userId: CLIENTE_A }, async (db) => {
      const blocked = await isWriteBlocked(
        db,
        `update public.profiles set role = 'superadmin' where id = $1`,
        [CLIENTE_A],
      );
      expect(blocked).toBe(true);
    });
  });

  // El guard salta ante cualquier cambio de `is_active`, en los dos sentidos.
  // Eso cubre el caso que importa: una cuenta desactivada por el equipo no
  // puede reactivarse sola.
  it('no puede tocar su propio estado de activación', async () => {
    await asRole(client, { role: 'authenticated', userId: CLIENTE_A }, async (db) => {
      const blocked = await isWriteBlocked(
        db,
        `update public.profiles set is_active = false where id = $1`,
        [CLIENTE_A],
      );
      expect(blocked).toBe(true);
    });
  });

  it('sí puede editar sus propios datos personales', async () => {
    await asRole(client, { role: 'authenticated', userId: CLIENTE_A }, async (db) => {
      const result = await db.query(
        `update public.profiles set full_name = 'Nombre Actualizado' where id = $1`,
        [CLIENTE_A],
      );
      expect(result.rowCount).toBe(1);
    });
  });

  // El panel de cliente edita `customers`, así que estas columnas están
  // expuestas a un formulario público. RLS autoriza la fila entera; quien
  // distingue qué columna es suya es `guard_customer_identity`.
  it('sí puede corregir su nombre y su teléfono', async () => {
    await asRole(client, { role: 'authenticated', userId: CLIENTE_A }, async (db) => {
      const result = await db.query(
        `update public.customers set first_name = 'Corregido', phone = '6000-0000'
         where profile_id = $1`,
        [CLIENTE_A],
      );
      expect(result.rowCount).toBe(1);
    });
  });

  it('no puede etiquetarse a sí mismo en el CRM', async () => {
    // Las etiquetas guían a quien atiende y segmentarán las campañas.
    await asRole(client, { role: 'authenticated', userId: CLIENTE_A }, async (db) => {
      const blocked = await isWriteBlocked(
        db,
        `update public.customers set tags = array['mayorista'] where profile_id = $1`,
        [CLIENTE_A],
      );
      expect(blocked).toBe(true);
    });
  });

  it('no puede inflar sus métricas de compra', async () => {
    await asRole(client, { role: 'authenticated', userId: CLIENTE_A }, async (db) => {
      const blocked = await isWriteBlocked(
        db,
        `update public.customers set total_spent = 999999, orders_count = 500
         where profile_id = $1`,
        [CLIENTE_A],
      );
      expect(blocked).toBe(true);
    });
  });

  it('no puede falsear la fecha de su último pedido', async () => {
    await asRole(client, { role: 'authenticated', userId: CLIENTE_A }, async (db) => {
      const blocked = await isWriteBlocked(
        db,
        `update public.customers set last_order_at = now() where profile_id = $1`,
        [CLIENTE_A],
      );
      expect(blocked).toBe(true);
    });
  });

  it('no puede robar la ficha de otro cambiando el correo', async () => {
    await asRole(client, { role: 'authenticated', userId: CLIENTE_A }, async (db) => {
      const blocked = await isWriteBlocked(
        db,
        `update public.customers set email = 'otro@test.local' where profile_id = $1`,
        [CLIENTE_A],
      );
      expect(blocked).toBe(true);
    });
  });

  // El consentimiento de marketing sí es suyo, pero su fecha es rastro de
  // auditoría: la sella el disparador, no quien rellena el formulario.
  it('al aceptar marketing, la fecha la pone la base de datos', async () => {
    await asRole(client, { role: 'authenticated', userId: CLIENTE_A }, async (db) => {
      await db.query(
        `update public.customers set accepts_marketing = false where profile_id = $1`,
        [CLIENTE_A],
      );

      await db.query(
        `update public.customers
         set accepts_marketing = true, marketing_opt_in_at = '2001-01-01'
         where profile_id = $1`,
        [CLIENTE_A],
      );

      const { rows } = await db.query<{ opt_in: Date | null }>(
        `select marketing_opt_in_at as opt_in from public.customers where profile_id = $1`,
        [CLIENTE_A],
      );

      expect(rows[0]?.opt_in).not.toBeNull();
      expect(rows[0]?.opt_in?.getFullYear()).toBeGreaterThan(2001);
    });
  });

  it('no puede modificar precios del catálogo', async () => {
    await asRole(client, { role: 'authenticated', userId: CLIENTE_A }, async (db) => {
      const result = await db.query(
        `update public.product_variants set price = 0.01 where price > 0`,
      );
      expect(result.rowCount).toBe(0);
    });
  });

  it('tampoco puede crear pedidos saltándose el servidor', async () => {
    await asRole(client, { role: 'authenticated', userId: CLIENTE_A }, async (db) => {
      const blocked = await isWriteBlocked(
        db,
        `select * from public.create_order('cliente-colado@test.local', '[]'::jsonb)`,
      );
      expect(blocked).toBe(true);
    });
  });

  it('sigue sin ver productos en borrador', async () => {
    await asRole(client, { role: 'authenticated', userId: CLIENTE_A }, async (db) => {
      const { rows } = await db.query(
        `select slug from public.products where slug = 'rls-borrador'`,
      );
      expect(rows).toHaveLength(0);
    });
  });
});

describeIfDb('operador (solo lectura del panel)', () => {
  it('ve todos los pedidos', async () => {
    const total = await asRole(client, { role: 'authenticated', userId: OPERADOR }, (db) =>
      countVisible(db, 'public.orders'),
    );
    expect(total).toBeGreaterThanOrEqual(2);
  });

  it('ve los productos en borrador', async () => {
    await asRole(client, { role: 'authenticated', userId: OPERADOR }, async (db) => {
      const { rows } = await db.query(`select slug from public.products where slug like 'rls-%'`);
      expect(rows).toHaveLength(2);
    });
  });

  it('NO puede modificar el catálogo', async () => {
    await asRole(client, { role: 'authenticated', userId: OPERADOR }, async (db) => {
      const result = await db.query(
        `update public.products set title = 'Cambiado por operador' where slug = 'rls-publicado'`,
      );
      expect(result.rowCount).toBe(0);
    });
  });

  it('ve las etiquetas del CRM', async () => {
    await asRole(client, { role: 'authenticated', userId: OPERADOR }, async (db) => {
      const { rows } = await db.query(`select 1 from public.crm_tags where name = 'rls-etiqueta'`);
      expect(rows).toHaveLength(1);
    });
  });

  it('NO puede crear etiquetas del CRM', async () => {
    await asRole(client, { role: 'authenticated', userId: OPERADOR }, async (db) => {
      const blocked = await isWriteBlocked(
        db,
        `insert into public.crm_tags (name) values ('rls-etiqueta-operador')`,
      );
      expect(blocked).toBe(true);
    });
  });

  it('NO puede borrar etiquetas del CRM', async () => {
    // RLS no lanza error al borrar una fila que la política oculta: simplemente
    // no borra nada. Por eso se comprueba que la etiqueta sigue viva, no que la
    // consulta falle.
    await asRole(client, { role: 'authenticated', userId: OPERADOR }, async (db) => {
      await db.query(`delete from public.crm_tags where name = 'rls-etiqueta'`);
      const { rows } = await db.query(`select 1 from public.crm_tags where name = 'rls-etiqueta'`);
      expect(rows).toHaveLength(1);
    });
  });

  it('NO puede tocar las integraciones', async () => {
    await asRole(client, { role: 'authenticated', userId: OPERADOR }, async (db) => {
      expect(await countVisible(db, 'public.integrations')).toBe(0);
    });
  });
});

describeIfDb('administrador', () => {
  it('ve todo el catálogo, incluidos borradores', async () => {
    await asRole(client, { role: 'authenticated', userId: ADMIN }, async (db) => {
      const { rows } = await db.query(`select slug from public.products where slug like 'rls-%'`);
      expect(rows).toHaveLength(2);
    });
  });

  it('puede editar el catálogo', async () => {
    await asRole(client, { role: 'authenticated', userId: ADMIN }, async (db) => {
      const result = await db.query(
        `update public.products set title = 'Editado por admin' where slug = 'rls-publicado'`,
      );
      expect(result.rowCount).toBe(1);
    });
  });

  it('ve los descuentos', async () => {
    await asRole(client, { role: 'authenticated', userId: ADMIN }, async (db) => {
      expect(await countVisible(db, 'public.discounts')).toBeGreaterThanOrEqual(1);
    });
  });

  it('NO puede cambiar roles: eso es exclusivo del superadministrador', async () => {
    await asRole(client, { role: 'authenticated', userId: ADMIN }, async (db) => {
      const result = await db.query(`update public.profiles set role = 'admin' where id = $1`, [
        CLIENTE_A,
      ]);
      expect(result.rowCount).toBe(0);
    });
  });

  it('NO puede activar integraciones: también es del superadministrador', async () => {
    await asRole(client, { role: 'authenticated', userId: ADMIN }, async (db) => {
      const result = await db.query(`update public.integrations set is_enabled = true`);
      expect(result.rowCount).toBe(0);
    });
  });
});
