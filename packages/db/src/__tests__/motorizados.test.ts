import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import { asRole, connect, countVisible, isDatabaseAvailable } from './helpers';

/**
 * Lo que un motorizado alcanza, contra Postgres real.
 *
 * POR QUÉ ESTE ARCHIVO ES EL MÁS IMPORTANTE DE LA FASE L4
 *
 * Un motorizado es la primera cuenta del sistema que **no es de la casa**: la
 * abre alguien de fuera, en su propio teléfono, en la calle. Lo que alcance esa
 * cuenta es la superficie que queda expuesta el día que le roben el móvil
 * desbloqueado o comparta la contraseña con un compañero.
 *
 * Las pantallas no cuentan aquí. Una pantalla que no enseña el catálogo sigue
 * pudiendo pedirlo con una llamada a la API. Lo único que decide de verdad es lo
 * que responde Postgres, y eso es lo que se prueba.
 *
 * DOS COSAS DISTINTAS, Y LAS DOS SE PRUEBAN
 *
 *  - **Qué filas ve** — eso lo deciden las políticas RLS.
 *  - **Qué columnas puede cambiar** — eso RLS no lo sabe, y lo decide el
 *    disparador `guard_courier_shipment_update`. Sin él, un motorizado con
 *    permiso para actualizar su envío podría reasignárselo a otro o cambiarle el
 *    destino, y la política lo dejaría pasar sin despeinarse.
 */

const available = await isDatabaseAvailable();
const describeIfDb = available ? describe : describe.skip;
let client: Client;

if (!available) {
  console.warn(
    '[motorizados] Sin base de datos disponible: se omiten los tests. ' +
      'Levántala con `pnpm db:start` o define TEST_DATABASE_URL.',
  );
}

const MOTORIZADO = '00000000-0000-4000-9000-000000000001';
const OTRO_MOTORIZADO = '00000000-0000-4000-9000-000000000002';
const CLIENTE = '00000000-0000-4000-9000-000000000003';
const ADMIN = '00000000-0000-4000-9000-000000000004';

/** El envío asignado a MOTORIZADO. Se rellena en el `beforeAll`. */
let envioPropio = '';
/** El envío asignado a OTRO_MOTORIZADO: el que no debe poder ni ver. */
let envioAjeno = '';
/**
 * Un segundo pedido, real y existente.
 *
 * Existe para que «mover mi envío a otro pedido» sea una operación *posible*.
 * Con un identificador inventado, la clave foránea la rechazaría sola y el test
 * pasaría en verde aunque no hubiera ninguna guardia — que es justo la clase de
 * test que no prueba nada.
 */
let otroPedido = '';

beforeAll(async () => {
  if (!available) return;

  client = await connect();
  await limpiar(client);

  await client.query('begin');

  await client.query(
    `insert into auth.users (id, email, raw_user_meta_data) values
       ($1, 'moto-uno@test.moto',  '{"full_name":"Moto Uno"}'),
       ($2, 'moto-dos@test.moto',  '{"full_name":"Moto Dos"}'),
       ($3, 'cliente@test.moto',   '{"full_name":"Cliente Moto"}'),
       ($4, 'admin@test.moto',     '{"full_name":"Admin Moto"}')
     on conflict (id) do nothing`,
    [MOTORIZADO, OTRO_MOTORIZADO, CLIENTE, ADMIN],
  );

  await client.query(`update public.profiles set role = 'courier' where id in ($1, $2)`, [
    MOTORIZADO,
    OTRO_MOTORIZADO,
  ]);
  await client.query(`update public.profiles set role = 'admin' where id = $1`, [ADMIN]);

  await client.query(
    `insert into public.couriers (profile_id, display_name, status) values
       ($1, 'Moto Uno', 'activo'),
       ($2, 'Moto Dos', 'activo')
     on conflict (profile_id) do nothing`,
    [MOTORIZADO, OTRO_MOTORIZADO],
  );

  // Un pedido con dos envíos: uno para cada motorizado.
  const { rows: pedidos } = await client.query<{ id: string }>(
    `insert into public.orders (email, subtotal, total, placed_at) values
       ('pedido@test.moto', 50, 50, now()),
       ('otro-pedido@test.moto', 10, 10, now())
     returning id`,
  );
  const pedidoId = pedidos[0]?.id;
  otroPedido = pedidos[1]?.id ?? '';

  // El pedido va cobrado entero. No es decorado: la regla de despacho de la fase
  // L3 —estricta por defecto— impide sacar del almacén un pedido con saldo, así
  // que sin este abono ni el panel podría mover estos envíos. Lo que aquí se
  // prueba son los permisos del motorizado, no esa regla, que tiene los suyos.
  await client.query(
    `insert into public.payments (order_id, provider, amount, status)
     values ($1, 'manual', 50, 'paid')`,
    [pedidoId],
  );

  const { rows: envios } = await client.query<{ id: string; assigned_to: string }>(
    `insert into public.shipments (order_id, assigned_to, destination) values
       ($1, $2, '{"line1":"Calle 50","phone":"6000-0000"}'::jsonb),
       ($1, $3, '{"line1":"Vía España"}'::jsonb)
     returning id, assigned_to`,
    [pedidoId, MOTORIZADO, OTRO_MOTORIZADO],
  );

  envioPropio = envios.find((e) => e.assigned_to === MOTORIZADO)?.id ?? '';
  envioAjeno = envios.find((e) => e.assigned_to === OTRO_MOTORIZADO)?.id ?? '';

  // Un producto y un descuento: lo que NO debe alcanzar.
  await client.query(
    `insert into public.products (slug, title, status)
     values ('moto-producto', 'Producto', 'active') on conflict (slug) do nothing`,
  );

  await client.query('commit');
}, 30_000);

afterAll(async () => {
  if (!available || !client) return;
  await limpiar(client);
  await client.end();
});

async function limpiar(db: Client): Promise<void> {
  await db.query(
    `delete from public.shipments where destination->>'line1' in ('Calle 50', 'Vía España')`,
  );
  await db.query(
    `delete from public.payments where order_id in
       (select id from public.orders where email like '%@test.moto')`,
  );
  await db.query(`delete from public.orders where email like '%@test.moto'`);
  await db.query(`delete from public.customers where email like '%@test.moto'`);
  await db.query(`delete from auth.users where email like '%@test.moto'`);
  await db.query(`delete from public.products where slug = 'moto-producto'`);
}

/** Ejecuta como el motorizado principal. */
async function comoMotorizado<T>(run: (db: Client) => Promise<T>): Promise<T> {
  return asRole(client, { role: 'authenticated', userId: MOTORIZADO }, run);
}

/**
 * Deja el envío en un estado concreto y **entonces** actúa como el motorizado.
 *
 * La preparación va como superusuario a propósito: llevar un envío de
 * «pendiente» a «asignado» es cosa del panel, y el disparador impide —con
 * razón— que lo haga el motorizado. Prepararlo con su sesión no probaría lo que
 * se quiere probar; probaría que la preparación falla.
 *
 * Todo ocurre en una transacción que se revierte, así que los estados no se
 * arrastran de un test al siguiente.
 */
const CAMINO = ['pendiente', 'asignado', 'recogido', 'en_ruta', 'entregado'] as const;

async function enEstado<T>(
  estado: (typeof CAMINO)[number] | 'fallido',
  run: (db: Client) => Promise<T>,
): Promise<T> {
  await client.query('begin');
  try {
    if (estado === 'fallido') {
      for (const paso of ['asignado', 'recogido']) {
        await client.query(`update public.shipments set status = $2 where id = $1`, [
          envioPropio,
          paso,
        ]);
      }
      await client.query(`update public.shipments set status = 'fallido' where id = $1`, [
        envioPropio,
      ]);
    } else {
      for (const paso of CAMINO.slice(1, CAMINO.indexOf(estado) + 1)) {
        await client.query(`update public.shipments set status = $2 where id = $1`, [
          envioPropio,
          paso,
        ]);
      }
    }

    await client.query('select set_config($1, $2, true)', ['request.jwt.claim.sub', MOTORIZADO]);
    await client.query('select set_config($1, $2, true)', [
      'request.jwt.claim.role',
      'authenticated',
    ]);
    await client.query('set local role authenticated');

    return await run(client);
  } finally {
    await client.query('rollback');
  }
}

/** ¿Rechazó Postgres esta escritura? Distingue el rechazo de la ausencia de fila. */
async function rechazada(db: Client, sql: string, params: unknown[] = []): Promise<boolean> {
  try {
    const resultado = await db.query(sql, params);
    // Cero filas afectadas también es un rechazo: RLS filtró la fila antes de
    // llegar a tocarla. Distinguirlo del error importa poco aquí; que no haya
    // cambiado nada, mucho.
    return resultado.rowCount === 0;
  } catch {
    return true;
  }
}

describeIfDb('un motorizado y los envíos', () => {
  it('ve el envío que lleva encima', async () => {
    await comoMotorizado(async (db) => {
      const { rows } = await db.query<{ id: string }>(`select id from public.shipments`);
      expect(rows.map((r) => r.id)).toEqual([envioPropio]);
    });
  });

  it('no ve el envío de otro motorizado', async () => {
    await comoMotorizado(async (db) => {
      const { rows } = await db.query(`select id from public.shipments where id = $1`, [
        envioAjeno,
      ]);
      expect(rows).toHaveLength(0);
    });
  });

  it('puede marcar como recogido el que ya tiene asignado', async () => {
    await enEstado('asignado', async (db) => {
      const resultado = await db.query(
        `update public.shipments set status = 'recogido' where id = $1`,
        [envioPropio],
      );
      expect(resultado.rowCount).toBe(1);
    });
  });

  it('no puede tocar el envío de otro', async () => {
    await comoMotorizado(async (db) => {
      expect(
        await rechazada(db, `update public.shipments set status = 'entregado' where id = $1`, [
          envioAjeno,
        ]),
      ).toBe(true);
    });
  });
});

/*
 * Estos cuatro son los que justifican el disparador. Todos pasan la política
 * —la fila es suya— y todos tienen que fallar igualmente.
 */
describeIfDb('un motorizado y las columnas que no le tocan', () => {
  it('no puede reasignarse el envío a otra persona', async () => {
    await comoMotorizado(async (db) => {
      expect(
        await rechazada(db, `update public.shipments set assigned_to = $2 where id = $1`, [
          envioPropio,
          OTRO_MOTORIZADO,
        ]),
      ).toBe(true);
    });
  });

  it('no puede cambiar el destino de su envío', async () => {
    await comoMotorizado(async (db) => {
      expect(
        await rechazada(
          db,
          `update public.shipments set destination = '{"line1":"Mi casa"}'::jsonb where id = $1`,
          [envioPropio],
        ),
      ).toBe(true);
    });
  });

  it('no puede mover su envío a otro pedido que sí existe', async () => {
    await comoMotorizado(async (db) => {
      expect(
        await rechazada(db, `update public.shipments set order_id = $2 where id = $1`, [
          envioPropio,
          otroPedido,
        ]),
      ).toBe(true);
    });
  });

  it('no puede falsear la hora de entrega', async () => {
    await comoMotorizado(async (db) => {
      expect(
        await rechazada(
          db,
          `update public.shipments set delivered_at = now() - interval '5 hours' where id = $1`,
          [envioPropio],
        ),
      ).toBe(true);
    });
  });

  it('no puede darse por devuelto un envío: eso lo decide quien despacha', async () => {
    // Desde «fallido», la máquina de estados sí permite «devuelto». Que aquí se
    // rechace es cosa del disparador y no de la máquina: es exactamente la
    // distinción que este test protege.
    await enEstado('fallido', async (db) => {
      expect(
        await rechazada(db, `update public.shipments set status = 'devuelto' where id = $1`, [
          envioPropio,
        ]),
      ).toBe(true);
    });
  });

  it('sí puede cerrar la entrega con su prueba', async () => {
    await enEstado('en_ruta', async (db) => {
      const resultado = await db.query(
        `update public.shipments
         set status = 'entregado', received_by = 'La vecina', delivery_note = 'Portón negro'
         where id = $1`,
        [envioPropio],
      );

      expect(resultado.rowCount).toBe(1);
    });
  });

  it('la hora de entrega la pone la base, no quien la marca', async () => {
    await enEstado('en_ruta', async (db) => {
      await db.query(`update public.shipments set status = 'entregado' where id = $1`, [
        envioPropio,
      ]);

      const { rows } = await db.query<{ reciente: boolean }>(
        `select delivered_at > now() - interval '1 minute' as reciente
         from public.shipments where id = $1`,
        [envioPropio],
      );

      expect(rows[0]?.reciente).toBe(true);
    });
  });
});

/*
 * Lo que un motorizado NO debe alcanzar. Es la lista de lo que queda expuesto si
 * su teléfono acaba en malas manos, y por eso se comprueba una por una en vez de
 * confiar en que «no tiene política, luego no ve nada».
 */
describeIfDb('un motorizado y el resto de la tienda', () => {
  const prohibido = [
    ['los pedidos', 'public.orders'],
    ['los códigos de descuento', 'public.discounts'],
    ['los cobros', 'public.payments'],
    ['las notas internas del CRM', 'public.crm_notes'],
  ] as const;

  for (const [que, tabla] of prohibido) {
    it(`no ve ${que}`, async () => {
      await comoMotorizado(async (db) => {
        expect(await countVisible(db, tabla)).toBe(0);
      });
    });
  }

  it('ve su propia ficha de motorizado y ninguna más', async () => {
    await comoMotorizado(async (db) => {
      const { rows } = await db.query<{ display_name: string }>(
        `select display_name from public.couriers`,
      );
      expect(rows.map((r) => r.display_name)).toEqual(['Moto Uno']);
    });
  });

  /*
   * Este no es un agujero: un motorizado también es una persona con cuenta en la
   * tienda, y el alta de usuario le crea su ficha de cliente como a cualquiera.
   * Ve la suya porque es suya. Se comprueba que sea EXACTAMENTE la suya, que es
   * lo que sí importa.
   */
  it('de las fichas de cliente ve solo la suya, por ser un usuario más', async () => {
    await comoMotorizado(async (db) => {
      const { rows } = await db.query<{ email: string }>(`select email from public.customers`);
      expect(rows.map((r) => r.email)).toEqual(['moto-uno@test.moto']);
    });
  });

  it('no puede darse de alta como motorizado ni cambiar su tarifa', async () => {
    await comoMotorizado(async (db) => {
      expect(
        await rechazada(db, `update public.couriers set rate = 999 where profile_id = $1`, [
          MOTORIZADO,
        ]),
      ).toBe(true);
    });
  });

  it('no puede ascenderse a administrador', async () => {
    await comoMotorizado(async (db) => {
      expect(
        await rechazada(db, `update public.profiles set role = 'admin' where id = $1`, [
          MOTORIZADO,
        ]),
      ).toBe(true);
    });
  });
});

/*
 * La ruta que sirve los ficheros privados no comprueba permisos por su cuenta:
 * lee la fila con el cliente de sesión y, si no hay fila, no hay clave. Así que
 * lo que de verdad protege la foto de una entrega y el comprobante de un abono
 * es lo que se prueba aquí — que la fila no se lee.
 */
describeIfDb('los ficheros privados', () => {
  it('un motorizado no puede leer la clave del comprobante de un abono', async () => {
    await comoMotorizado(async (db) => {
      const { rows } = await db.query(`select receipt_key from public.payments`);
      expect(rows).toHaveLength(0);
    });
  });

  it('un motorizado sí ve la clave de la prueba de SU entrega', async () => {
    await comoMotorizado(async (db) => {
      const { rows } = await db.query<{ id: string }>(
        `select id, delivery_proof_key from public.shipments`,
      );
      expect(rows.map((r) => r.id)).toEqual([envioPropio]);
    });
  });

  it('un motorizado no alcanza la clave de la prueba de una entrega ajena', async () => {
    await comoMotorizado(async (db) => {
      const { rows } = await db.query(
        `select delivery_proof_key from public.shipments where id = $1`,
        [envioAjeno],
      );
      expect(rows).toHaveLength(0);
    });
  });

  it('un cliente con sesión no alcanza ninguna de las dos', async () => {
    await asRole(client, { role: 'authenticated', userId: CLIENTE }, async (db) => {
      expect(await countVisible(db, 'public.shipments')).toBe(0);
      expect(await countVisible(db, 'public.payments')).toBe(0);
    });
  });

  /*
   * A un visitante anónimo lo paran las dos tablas, pero **RLS a solas**, sin la
   * capa de permisos por debajo. Y eso NO es lo que el repositorio creía.
   *
   * La migración 0022 dice que `anon` «se deja fuera» de las tablas nuevas
   * porque sus `alter default privileges` solo nombran a `authenticated` y
   * `service_role`. Pero el arranque de Supabase declara los suyos concediendo a
   * `anon`, y los suyos también aplican: `shipments` y `payments` nacieron con
   * permisos para el público, y lo único que las protege es la política.
   *
   * Se descubrió porque este test, escrito contra un Postgres pelado donde esos
   * privilegios por omisión no existen, esperaba «permission denied» y en CI
   * —Supabase de verdad— devolvió cero filas. Queda escrito así para que nadie
   * vuelva a leer el comentario de la 0022 y se lo crea.
   */
  it('a un visitante anónimo RLS le devuelve cero envíos y cero cobros', async () => {
    await asRole(client, { role: 'anon' }, async (db) => {
      expect(await countVisible(db, 'public.shipments')).toBe(0);
      expect(await countVisible(db, 'public.payments')).toBe(0);
    });
  });

  /*
   * Las dos tablas de esta fase sí revocan a `anon` explícitamente, en vez de
   * confiar en que no se le concedió. Aquí la consulta ni siquiera llega a mirar
   * políticas, que es una capa más de la que tienen las tablas anteriores.
   *
   * Importa por `truncate`: no está sujeto a RLS, así que el privilegio es lo
   * único que separa a un anónimo de vaciar la tabla.
   */
  it('a un visitante anónimo se le rechaza la consulta de motorizados antes de mirar políticas', async () => {
    await asRole(client, { role: 'anon' }, async (db) => {
      await expect(countVisible(db, 'public.couriers')).rejects.toThrow(/permission denied/i);
    });
  });

  it('un visitante anónimo tampoco puede vaciar la tabla de motorizados', async () => {
    await asRole(client, { role: 'anon' }, async (db) => {
      await expect(db.query('truncate public.courier_zones')).rejects.toThrow(/permission denied/i);
    });
  });

  /*
   * Este es el que de verdad protege la caja. `anon` tiene `insert` concedido
   * sobre `payments` —un permiso que sobra— así que lo único que impide que un
   * visitante se invente un cobro de mil dólares sobre un pedido ajeno es la
   * política. Queda fijado aquí para que nadie la relaje sin enterarse.
   */
  it('un visitante anónimo no puede inventarse un cobro', async () => {
    await asRole(client, { role: 'anon' }, async (db) => {
      await expect(
        db.query(
          `insert into public.payments (order_id, provider, amount, status)
           values ($1, 'manual', 999, 'paid')`,
          [otroPedido],
        ),
      ).rejects.toThrow(/row-level security/i);
    });
  });
});

describeIfDb('el equipo sigue viéndolo todo', () => {
  it('un administrador ve los dos envíos y las dos fichas', async () => {
    await asRole(client, { role: 'authenticated', userId: ADMIN }, async (db) => {
      expect(await countVisible(db, 'public.shipments')).toBe(2);
      expect(await countVisible(db, 'public.couriers')).toBe(2);
    });
  });

  it('un cliente con sesión no ve ninguna ficha de motorizado', async () => {
    await asRole(client, { role: 'authenticated', userId: CLIENTE }, async (db) => {
      expect(await countVisible(db, 'public.couriers')).toBe(0);
    });
  });
});
