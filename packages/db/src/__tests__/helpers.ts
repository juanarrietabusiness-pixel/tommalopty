import { Client } from 'pg';

/**
 * Utilidades para probar las políticas RLS contra un Postgres real.
 *
 * Probar RLS con mocks no sirve de nada: lo que hay que verificar es lo que
 * decide Postgres, no lo que cree la aplicación. Por eso estos tests se
 * conectan a una base de datos de verdad con el esquema aplicado.
 */

const CONNECTION_STRING =
  process.env.TEST_DATABASE_URL ??
  process.env.SUPABASE_DB_URL ??
  'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

export async function connect(): Promise<Client> {
  const client = new Client({ connectionString: CONNECTION_STRING });
  await client.connect();
  return client;
}

/** ¿Hay base de datos disponible? Si no, los tests se saltan en vez de fallar. */
export async function isDatabaseAvailable(): Promise<boolean> {
  try {
    const client = new Client({
      connectionString: CONNECTION_STRING,
      connectionTimeoutMillis: 2000,
    });
    await client.connect();
    await client.query('select 1');
    await client.end();
    return true;
  } catch {
    return false;
  }
}

export interface RoleContext {
  /** Rol de Postgres: 'anon' o 'authenticated'. */
  role: 'anon' | 'authenticated';
  /** UUID del usuario, lo que `auth.uid()` devolverá dentro de las políticas. */
  userId?: string | null;
}

/**
 * Ejecuta una consulta suplantando a un rol concreto, igual que haría PostgREST.
 *
 * Todo ocurre dentro de una transacción que se revierte al terminar: los tests
 * no se contaminan entre sí y la base queda como estaba.
 */
export async function asRole<T>(
  client: Client,
  context: RoleContext,
  run: (client: Client) => Promise<T>,
): Promise<T> {
  await client.query('begin');
  try {
    await client.query('select set_config($1, $2, true)', [
      'request.jwt.claim.sub',
      context.userId ?? '',
    ]);
    await client.query('select set_config($1, $2, true)', ['request.jwt.claim.role', context.role]);
    await client.query(`set local role ${context.role}`);

    return await run(client);
  } finally {
    await client.query('rollback');
  }
}

/** Cuenta filas visibles de una tabla para el rol activo. */
export async function countVisible(client: Client, table: string): Promise<number> {
  const result = await client.query<{ total: string }>(
    `select count(*)::text as total from ${table}`,
  );
  return Number(result.rows[0]?.total ?? 0);
}

/** Comprueba si una escritura es rechazada por RLS (o por falta de permisos). */
export async function isWriteBlocked(
  client: Client,
  sql: string,
  params: unknown[] = [],
): Promise<boolean> {
  try {
    await client.query(sql, params);
    return false;
  } catch (error) {
    const code = (error as { code?: string }).code;
    // 42501 = insufficient_privilege (RLS rechazó la operación)
    return code === '42501';
  }
}
