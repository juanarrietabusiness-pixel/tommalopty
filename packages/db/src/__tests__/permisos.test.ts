import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import { asRole, connect, isDatabaseAvailable } from './helpers';

/**
 * Permisos de tabla y de columna, contra Postgres real.
 *
 * POR QUÉ ESTE ARCHIVO EXISTE
 *
 * El resto de los tests comprueba RLS: qué *filas* ve cada rol. Este comprueba
 * lo de un piso más abajo: si el rol tiene siquiera permiso para tocar la tabla.
 * Son cosas distintas y fallan distinto. RLS de más devuelve cero filas; un
 * permiso de menos revienta la consulta con «permission denied».
 *
 * Y esa diferencia costó un despliegue entero. La tienda pasó del 20 al 31 de
 * agosto sin poder leer su propio catálogo —una columna revocada que la vista
 * seguía leyendo— y nadie lo vio, porque en local todo se prueba con la clave de
 * servicio y con la de servicio esto no falla nunca.
 *
 * La regla que codifica: **cada consulta que las aplicaciones hacen de verdad
 * tiene que ser ejecutable por el rol que la hará de verdad.** No se comprueba
 * que haya datos; se comprueba que Postgres no la rechace.
 */

const CONSULTAS_DE_LA_TIENDA: { nombre: string; sql: string }[] = [
  {
    nombre: 'el grid de productos (product_catalog)',
    sql: 'select id, slug, title, price, available_quantity from public.product_catalog limit 1',
  },
  {
    nombre: 'la búsqueda',
    sql: "select * from public.search_products('mesa', 5, 0)",
  },
  {
    // Es la forma exacta de `listProducts` y `getProductBySlug`: producto →
    // variantes → inventario, restando las reservas.
    nombre: 'la ficha de producto con su stock',
    sql: `select p.id, v.price, greatest(i.quantity - i.reserved_quantity, 0)
          from public.products p
          left join public.product_variants v on v.product_id = p.id
          left join public.inventory i on i.variant_id = v.id
          limit 1`,
  },
  {
    nombre: 'las zonas de reparto del checkout',
    sql: 'select id, name, polygon, shipping_price, handled_by from public.delivery_zones limit 1',
  },
  {
    nombre: 'las páginas de contenido',
    sql: 'select slug, title from public.cms_pages limit 1',
  },
];

/**
 * Lo que el panel necesita leer con una sesión de equipo.
 *
 * Esta lista existe porque faltaba. La primera versión de este archivo solo
 * comprobaba `anon` —las consultas de la tienda— y el panel se quedó fuera. El
 * resultado fue que el dashboard respondía «server error» nada más entrar, por
 * exactamente el mismo motivo que había roto la tienda: una columna revocada
 * que una vista `security_invoker` seguía leyendo.
 *
 * La trampa que hay detrás: `authenticated` no es sinónimo de «cliente». Quien
 * administra la tienda también es `authenticated`, así que revocar una columna
 * de ese rol se la quita igual a la dueña del negocio.
 */
const CONSULTAS_DEL_PANEL: { nombre: string; sql: string }[] = [
  { nombre: 'las métricas del dashboard', sql: 'select public.dashboard_metrics(30)' },
  { nombre: 'las ventas por día', sql: 'select * from public.report_sales_daily limit 1' },
  { nombre: 'los más vendidos', sql: 'select * from public.report_top_products limit 1' },
  { nombre: 'el informe de stock bajo', sql: 'select * from public.report_low_stock limit 1' },
  {
    nombre: 'el embudo de conversión',
    sql: 'select * from public.report_conversion_funnel limit 1',
  },
  {
    nombre: 'la pantalla de inventario',
    sql: `select variant_id, quantity, reserved_quantity, low_stock_threshold
          from public.inventory limit 1`,
  },
  {
    nombre: 'la pantalla de catálogo',
    sql: `select p.id, v.price, i.quantity, i.reserved_quantity
          from public.products p
          left join public.product_variants v on v.product_id = p.id
          left join public.inventory i on i.variant_id = v.id
          limit 1`,
  },
  {
    nombre: 'los pedidos con su saldo',
    sql: 'select id, order_number, total, amount_paid, balance_due from public.orders limit 1',
  },
  {
    nombre: 'las líneas del pedido',
    sql: 'select id, product_title from public.order_items limit 1',
  },
  { nombre: 'los pagos', sql: 'select id, provider, amount from public.payments limit 1' },
  { nombre: 'la ficha de cliente', sql: 'select id, email, tags from public.customers limit 1' },
  {
    nombre: 'las zonas de reparto',
    sql: 'select id, name, polygon from public.delivery_zones limit 1',
  },
  { nombre: 'usuarios y roles', sql: 'select id, email, role from public.profiles limit 1' },
];

/**
 * Columnas que la tienda NO debe poder leer. Se comprueban una a una porque el
 * permiso es por columna: perderlo no rompe nada visible, solo destapa datos.
 */
const COLUMNAS_PROHIBIDAS: {
  tabla: string;
  columna: string;
  roles: ('anon' | 'authenticated')[];
  porque: string;
}[] = [
  {
    tabla: 'public.product_variants',
    columna: 'cost_price',
    // Para los dos roles: el margen no lo necesita ninguna pantalla, ni la de
    // la tienda ni la del panel. Es la revocación que sí protege algo.
    roles: ['anon', 'authenticated'],
    porque: 'es el margen de todo el catálogo y ninguna pantalla lo usa',
  },
  {
    tabla: 'public.inventory',
    columna: 'low_stock_threshold',
    // Solo `anon`. Al panel le hace falta, y el panel es `authenticated`.
    roles: ['anon'],
    porque: 'la tienda pública no tiene nada que hacer con un umbral de reposición',
  },
  {
    tabla: 'public.inventory',
    columna: 'location',
    roles: ['anon'],
    porque: 'es dónde está guardada la mercancía',
  },
];
// Igual que en `rls.test.ts`: la comprobación va en el nivel superior del
// módulo porque Vitest decide qué bloques registrar antes de ejecutar los hooks.
// Sin base de datos estos tests se marcan omitidos, no aprobados: un verde falso
// aquí sería peor que no tenerlos.
const disponible = await isDatabaseAvailable();
const describeSiHayBase = disponible ? describe : describe.skip;

if (!disponible) {
  console.warn(
    '[permisos] Sin base de datos disponible: se omiten los tests de permisos. ' +
      'Levántala con `pnpm db:start` o define TEST_DATABASE_URL.',
  );
}

/**
 * Una cuenta con rol de equipo, para las consultas del panel.
 *
 * Hace falta de verdad, no por completar el escenario: `dashboard_metrics`
 * comprueba `is_staff()` por su cuenta y responde «No autorizado.» a cualquier
 * sesión que no sea de equipo. La primera versión de este archivo la probó con
 * un superadministrador real contra la base de staging y pasó; en CI, donde la
 * sesión es un `authenticated` cualquiera, falló. El fallo era del test.
 *
 * Y este comentario estuvo mintiendo cinco días. La guardia existía cuando se
 * escribió, la migración 0034 la borró sin querer al reescribir la función por
 * otro motivo, y aquí seguía descrita como si estuviera. Lo que no lo dijo fue
 * que este bloque solo comprueba que el equipo SÍ puede: nadie probaba que un
 * cliente no. Esa mitad está más abajo, en «funciones alcanzables desde
 * fuera».
 */
const STAFF = '00000000-0000-0000-0000-0000000000a1';

describeSiHayBase('permisos de tabla', () => {
  let client: Client;

  beforeAll(async () => {
    client = await connect();

    await client.query(
      `insert into auth.users (id, email, raw_user_meta_data)
       values ($1, 'permisos-staff@test.local', '{"full_name":"Equipo"}')
       on conflict (id) do nothing`,
      [STAFF],
    );
    // El perfil lo crea el disparador de alta; aquí solo se le sube el rol.
    await client.query(`update public.profiles set role = 'admin' where id = $1`, [STAFF]);
  });

  afterAll(async () => {
    if (!client) return;
    // En cascada se lleva el perfil y la ficha de cliente.
    await client.query('delete from auth.users where id = $1', [STAFF]);
    await client.end();
  });

  describe('lo que la tienda necesita leer sin sesión', () => {
    for (const consulta of CONSULTAS_DE_LA_TIENDA) {
      it(`anon puede ejecutar ${consulta.nombre}`, async () => {
        const error = await asRole(client, { role: 'anon' }, async (c) => {
          try {
            await c.query(consulta.sql);
            return null;
          } catch (e) {
            return e as { code?: string; message?: string };
          }
        });

        // Se mira el mensaje y no solo el código: si algún día falla, lo que
        // hace falta para arreglarlo es saber qué tabla o columna faltaba.
        expect(error?.message ?? 'sin error').toBe('sin error');
      });
    }
  });

  describe('lo que el panel necesita leer con sesión de equipo', () => {
    for (const consulta of CONSULTAS_DEL_PANEL) {
      it(`authenticated puede ejecutar ${consulta.nombre}`, async () => {
        const error = await asRole(client, { role: 'authenticated', userId: STAFF }, async (c) => {
          try {
            await c.query(consulta.sql);
            return null;
          } catch (e) {
            return e as { code?: string; message?: string };
          }
        });

        expect(error?.message ?? 'sin error').toBe('sin error');
      });
    }
  });

  describe('lo que no debe poder leerse', () => {
    for (const { tabla, columna, roles, porque } of COLUMNAS_PROHIBIDAS) {
      for (const rol of roles) {
        it(`${rol} no lee ${tabla}.${columna}, porque ${porque}`, async () => {
          const codigo = await asRole(client, { role: rol }, async (c) => {
            try {
              await c.query(`select ${columna} from ${tabla} limit 1`);
              return 'se pudo leer';
            } catch (e) {
              return (e as { code?: string }).code ?? 'error sin código';
            }
          });

          expect(codigo).toBe('42501');
        });
      }
    }
  });

  describe('la lista de invitaciones no la alcanza nadie', () => {
    for (const rol of ['anon', 'authenticated', 'service_role']) {
      it(`${rol} no puede leerla ni escribirla`, async () => {
        const { rows } = await client.query<{
          leer: boolean;
          insertar: boolean;
          actualizar: boolean;
          borrar: boolean;
        }>(
          `select has_table_privilege($1, 'public.admin_bootstrap', 'SELECT') as leer,
                  has_table_privilege($1, 'public.admin_bootstrap', 'INSERT') as insertar,
                  has_table_privilege($1, 'public.admin_bootstrap', 'UPDATE') as actualizar,
                  has_table_privilege($1, 'public.admin_bootstrap', 'DELETE') as borrar`,
          [rol],
        );

        expect(rows[0]).toEqual({
          leer: false,
          insertar: false,
          actualizar: false,
          borrar: false,
        });
      });
    }
  });

  /**
   * `service_role` es el rol del servidor: salta RLS y solo se usa con la clave
   * secreta. Estuvo sin un solo privilegio de tabla desde el principio, y no se
   * notó porque `create_order` es `security definer` y corre como su dueño. Lo
   * que fallaba era todo lo demás de la misma petición: registrar el pago,
   * releer las líneas para el correo, anotar el evento del pedido.
   */
  describe('lo que el servidor necesita para confirmar un pedido', () => {
    const TABLAS_DEL_SERVIDOR = [
      'public.orders',
      'public.order_items',
      'public.order_events',
      'public.payments',
      'public.payment_webhook_events',
      'public.customers',
    ];

    for (const tabla of TABLAS_DEL_SERVIDOR) {
      it(`service_role puede leer y escribir en ${tabla}`, async () => {
        // Se pregunta por el privilegio en vez de ejecutar una escritura de
        // prueba: así la comprobación no depende de qué columnas tenga cada
        // tabla ni deja nada que revertir.
        const { rows } = await client.query<{
          leer: boolean;
          insertar: boolean;
          actualizar: boolean;
          borrar: boolean;
        }>(
          `select has_table_privilege('service_role', $1, 'SELECT') as leer,
                  has_table_privilege('service_role', $1, 'INSERT') as insertar,
                  has_table_privilege('service_role', $1, 'UPDATE') as actualizar,
                  has_table_privilege('service_role', $1, 'DELETE') as borrar`,
          [tabla],
        );

        expect(rows[0]).toEqual({ leer: true, insertar: true, actualizar: true, borrar: true });
      });
    }
  });

  /**
   * Lo que el público NO alcanza, que es la mitad que faltaba.
   *
   * Hasta la migración 0033, este archivo solo comprobaba que `anon` pudiera
   * hacer lo que la tienda necesita. Nada comprobaba lo contrario, y por eso
   * pasó desapercibido durante todo el proyecto que `anon` tenía `truncate`
   * sobre cada tabla —incluidas `orders` y `payments`— sin que ninguna
   * migración se lo hubiera dado.
   *
   * `truncate` es el que importa: es el único de los cinco que **no pasa por
   * RLS**, porque las políticas filtran filas y `truncate` no mira filas. Con
   * `select` o `delete`, una política que devuelve cero filas ya protege; con
   * `truncate`, lo único que separa a un visitante anónimo de vaciar la tabla
   * es el privilegio.
   */
  describe('lo que el público no alcanza', () => {
    const SOLO_DEL_EQUIPO = [
      'public.orders',
      'public.order_items',
      'public.order_events',
      'public.payments',
      'public.payment_webhook_events',
      'public.shipments',
      'public.customers',
      'public.addresses',
      'public.profiles',
      'public.couriers',
      'public.courier_zones',
      'public.crm_notes',
      'public.crm_tags',
      'public.discounts',
      'public.discount_redemptions',
      'public.campaigns',
      'public.integrations',
      'public.audit_log',
      'public.carts',
      'public.cart_items',
      'public.wishlists',
      'public.wishlist_items',
    ];

    for (const tabla of SOLO_DEL_EQUIPO) {
      it(`anon no tiene ningún privilegio sobre ${tabla}`, async () => {
        const { rows } = await client.query<Record<string, boolean>>(
          `select has_table_privilege('anon', $1, 'SELECT')   as leer,
                  has_table_privilege('anon', $1, 'INSERT')   as insertar,
                  has_table_privilege('anon', $1, 'UPDATE')   as actualizar,
                  has_table_privilege('anon', $1, 'DELETE')   as borrar,
                  has_table_privilege('anon', $1, 'TRUNCATE') as vaciar`,
          [tabla],
        );

        expect(rows[0]).toEqual({
          leer: false,
          insertar: false,
          actualizar: false,
          borrar: false,
          vaciar: false,
        });
      });
    }

    /**
     * Las tablas que la tienda sí lee conservan `select` y nada más. Este test
     * es el que impide «arreglar» el de arriba revocándolo todo: si alguien
     * quita el `select` del catálogo, la tienda se queda sin catálogo, y eso ya
     * duró once días sin que nadie lo viera (`docs/ESTADO.md` § 4).
     */
    const PUBLICAS_DE_SOLO_LECTURA = [
      'public.products',
      'public.product_images',
      'public.product_options',
      'public.product_categories',
      'public.categories',
      'public.reviews',
      'public.settings',
      'public.shipping_methods',
      'public.delivery_zones',
      'public.cms_pages',
      'public.cms_posts',
      'public.cms_banners',
      'public.cms_menus',
    ];

    for (const tabla of PUBLICAS_DE_SOLO_LECTURA) {
      it(`anon lee ${tabla}, pero no la escribe ni la vacía`, async () => {
        const { rows } = await client.query<Record<string, boolean>>(
          `select has_table_privilege('anon', $1, 'SELECT')   as leer,
                  has_table_privilege('anon', $1, 'INSERT')   as insertar,
                  has_table_privilege('anon', $1, 'UPDATE')   as actualizar,
                  has_table_privilege('anon', $1, 'DELETE')   as borrar,
                  has_table_privilege('anon', $1, 'TRUNCATE') as vaciar`,
          [tabla],
        );

        expect(rows[0]).toEqual({
          leer: true,
          insertar: false,
          actualizar: false,
          borrar: false,
          vaciar: false,
        });
      });
    }

    /**
     * `leads` ya no tiene puerta pública (#9).
     *
     * Antes `anon` podía INSERTAR, y la política lo permitía con `check (true)`.
     * Eso convertía en decorativo cualquier límite de tasa en `/api/newsletter`:
     * bastaba con ir directo a PostgREST con la clave publicable, que va en el
     * navegador por diseño.
     *
     * Ahora la ruta es la única puerta y usa `service_role`. Este test es lo que
     * impide que alguien devuelva el privilegio «para que funcione el
     * formulario» sin darse cuenta de lo que reabre.
     */
    it('ni anon ni authenticated tocan leads', async () => {
      const { rows } = await client.query<Record<string, boolean>>(
        `select has_table_privilege('anon', 'public.leads', 'SELECT')            as anon_lee,
                has_table_privilege('anon', 'public.leads', 'INSERT')            as anon_inserta,
                has_table_privilege('authenticated', 'public.leads', 'SELECT')   as auth_lee,
                has_table_privilege('authenticated', 'public.leads', 'INSERT')   as auth_inserta,
                has_table_privilege('authenticated', 'public.leads', 'TRUNCATE') as auth_vacia`,
      );

      expect(rows[0]).toEqual({
        anon_lee: false,
        anon_inserta: false,
        auth_lee: false,
        auth_inserta: false,
        auth_vacia: false,
      });
    });

    /**
     * Y lo que cuenta los intentos tampoco se ve desde fuera.
     *
     * `lead_intentos` guarda hashes de IP. Poder leerlos, o poder llamar a
     * `hash_de_ip`, permitiría comprobar si una IP concreta pasó por aquí — que
     * es exactamente lo que hashearlas venía a evitar.
     */
    it('el contador de intentos y su sal son solo del servidor', async () => {
      const { rows } = await client.query<Record<string, boolean>>(
        `select has_table_privilege('anon', 'public.lead_intentos', 'SELECT')          as anon_ve_intentos,
                has_table_privilege('authenticated', 'public.lead_intentos', 'SELECT') as auth_ve_intentos,
                has_table_privilege('anon', 'public.lead_sal', 'SELECT')               as anon_ve_sal,
                has_table_privilege('authenticated', 'public.lead_sal', 'SELECT')      as auth_ve_sal,
                has_function_privilege('anon', 'public.hash_de_ip(text)', 'EXECUTE')   as anon_hashea,
                has_function_privilege('anon', 'public.registrar_lead(text, text, jsonb, text, integer)', 'EXECUTE') as anon_registra`,
      );

      expect(rows[0]).toEqual({
        anon_ve_intentos: false,
        auth_ve_intentos: false,
        anon_ve_sal: false,
        auth_ve_sal: false,
        anon_hashea: false,
        anon_registra: false,
      });
    });

    /**
     * `create_order` sigue siendo solo del servidor (#10).
     *
     * Añadirle un parámetro creó una función NUEVA, y una función nueva nace con
     * EXECUTE para PUBLIC. Sin revocar a mano, el arreglo del checkout de
     * invitado habría abierto un agujero mayor que el que cerraba.
     */
    it('create_order no la puede llamar nadie de fuera', async () => {
      const firma =
        'public.create_order(text, jsonb, jsonb, uuid, text, text, text, text, text, uuid)';

      const { rows } = await client.query<Record<string, boolean | number>>(
        `select has_function_privilege('anon', '${firma}', 'EXECUTE')          as anon,
                has_function_privilege('authenticated', '${firma}', 'EXECUTE') as autenticado,
                has_function_privilege('service_role', '${firma}', 'EXECUTE')  as servidor,
                (select count(*) from pg_proc p
                   join pg_namespace n on n.oid = p.pronamespace
                  where n.nspname = 'public' and p.proname = 'create_order')::int as cuantas`,
      );

      // `cuantas: 1` es la mitad que se olvida: si la sobrecarga vieja de nueve
      // argumentos siguiera existiendo, seguiría siendo llamable y el arreglo no
      // serviría de nada.
      expect(rows[0]).toEqual({ anon: false, autenticado: false, servidor: true, cuantas: 1 });
    });

    /**
     * `anonimizar_cliente` la puede llamar una sesión, pero no cualquiera (#46).
     *
     * Es lo contrario de `create_order`, y la diferencia es deliberada. Esta se
     * concede a `authenticated` a propósito: corre con la sesión de quien pulsa
     * y su primera línea es `is_superadmin()`, así que la base decide por sí
     * misma quién puede. Si se llamara con la clave de servicio, esa
     * comprobación no significaría nada — el servidor siempre pasaría — y el
     * único guardia sería el `if` de la Server Action.
     *
     * Lo que sí tiene que estar cerrado es `anon`: la función se salta RLS.
     */
    it('anonimizar_cliente está cerrada a anónimos y abierta a la sesión', async () => {
      const firma = 'public.anonimizar_cliente(uuid)';

      const { rows } = await client.query<Record<string, boolean>>(
        `select has_function_privilege('anon', '${firma}', 'EXECUTE')          as anon,
                has_function_privilege('authenticated', '${firma}', 'EXECUTE') as autenticado,
                has_function_privilege('service_role', '${firma}', 'EXECUTE')  as servidor,
                (select p.prosecdef from pg_proc p
                   join pg_namespace n on n.oid = p.pronamespace
                  where n.nspname = 'public' and p.proname = 'anonimizar_cliente') as definer`,
      );

      expect(rows[0]).toEqual({
        anon: false,
        autenticado: true,
        servidor: true,
        // `security definer` es lo que le deja saltarse RLS para tocar los
        // pedidos y los envíos de otro. Si dejara de serlo, la función pasaría
        // los tests de arriba y no anonimizaría nada.
        definer: true,
      });
    });

    /**
     * Y que las futuras nazcan limpias.
     *
     * Esto es lo que cierra el agujero en vez de taparlo: sin este test, la
     * próxima tabla vuelve a nacer con los privilegios que le dan los
     * `alter default privileges` y nadie se entera hasta la siguiente auditoría.
     * Se crea una tabla de verdad porque preguntarle a `pg_default_acl` sería
     * comprobar la intención; esto comprueba el resultado.
     *
     * OJO CON LO QUE **NO** CUBRE, y por eso el nombre dice «por una migración».
     * La tabla se crea con la conexión de este test, que es `postgres` — el rol
     * que ejecuta las migraciones. Y `pg_default_acl` tiene una entrada por cada
     * rol que crea tablas, que no conceden lo mismo: la de `postgres` ya no le
     * da nada a `anon`, pero la de `supabase_admin` le sigue dando los ocho
     * privilegios, `TRUNCATE` incluido. Una tabla creada desde el panel de
     * Supabase nace abierta al público y este test no se entera. No se puede
     * cambiar desde una migración; queda dicho aquí para que nadie lea de este
     * test una garantía que no da.
     */
    it('una tabla creada por una migración nace sin nada para anon', async () => {
      await client.query('create table public.zz_prueba_de_privilegios (id int)');
      try {
        const { rows } = await client.query<{ privilegios: string | null }>(
          `select string_agg(privilege_type, ',' order by privilege_type) as privilegios
           from information_schema.role_table_grants
           where table_schema = 'public'
             and table_name = 'zz_prueba_de_privilegios'
             and grantee = 'anon'`,
        );

        // Sobre el objeto entero y no sobre el campo: así la comprobación
        // también falla si la consulta no devolviera ninguna fila.
        expect(rows[0]).toEqual({ privilegios: null });
      } finally {
        await client.query('drop table if exists public.zz_prueba_de_privilegios');
      }
    });

    /**
     * Y que además nazca con RLS activo (issue #68).
     *
     * El test de arriba mira los PRIVILEGIOS de una tabla nueva; este mira su
     * RLS. Son dos cosas distintas y las dos hacen falta: sin privilegios pero
     * sin RLS, cualquier `grant` posterior la abre entera.
     *
     * Lo garantiza un disparador de eventos DDL, `ensure_rls`. Este test existe
     * porque el disparador estuvo meses **fuera del control de versiones**: vivía
     * en la base de staging y en ningún fichero. El issue #11 se cerró
     * comprobándolo contra staging —donde funcionaba— sin comprobar que se
     * reprodujera desde las migraciones, que es donde no estaba.
     *
     * Por eso el test vive aquí y no en staging: corre contra un Postgres
     * levantado solo desde `supabase/migrations`, que era exactamente el
     * entorno donde la garantía no existía. Si alguien borra la migración
     * `20260906140000`, esto se pone rojo.
     *
     * **La lección, que vale más que el arreglo:** preguntarle a la base de
     * datos y preguntarle al código son dos comprobaciones distintas. La
     * primera dice qué hay; la segunda, qué se reproduce.
     */
    describe('el disparador que activa RLS en toda tabla nueva', () => {
      it('existe, con las tres etiquetas que crean una tabla', async () => {
        const { rows } = await client.query<{
          evento: string;
          tags: string | null;
          habilitado: string;
        }>(
          `select e.evtevent as evento,
                  array_to_string(e.evttags, ',') as tags,
                  e.evtenabled::text as habilitado
             from pg_event_trigger e
            where e.evtname = 'ensure_rls'`,
        );

        // Las tres, no solo `CREATE TABLE`: `CREATE TABLE AS` y `SELECT INTO`
        // también crean una tabla, y dejarlas fuera es dejar dos puertas.
        expect(rows[0]).toEqual({
          evento: 'ddl_command_end',
          tags: 'CREATE TABLE,CREATE TABLE AS,SELECT INTO',
          habilitado: 'O',
        });
      });

      it('una tabla nueva sale con RLS sin que nadie lo pida', async () => {
        await client.query('begin');
        try {
          await client.query('create table public.zz_prueba_rls (id int)');

          const { rows } = await client.query<{ rls: boolean; politicas: number }>(
            `select c.relrowsecurity as rls,
                    (select count(*)::int from pg_policies
                      where schemaname = 'public' and tablename = 'zz_prueba_rls') as politicas
               from pg_class c
               join pg_namespace n on n.oid = c.relnamespace
              where n.nspname = 'public' and c.relname = 'zz_prueba_rls'`,
          );

          // `politicas: 0` no es un detalle de más: es la mitad que hay que
          // recordar. El disparador activa RLS, NO escribe políticas. Una tabla
          // nueva queda en el estado seguro —nadie ve nada— y no en el útil.
          expect(rows[0]).toEqual({ rls: true, politicas: 0 });
        } finally {
          await client.query('rollback');
        }
      });

      /**
       * La trampa del orden, que es lo que casi se cuela.
       *
       * La migración 0021 revoca `EXECUTE` en masa a las funciones de
       * disparador consultando el catálogo, y corre ANTES que la que crea esta.
       * En staging da igual —la función ya existía y `create or replace`
       * conserva privilegios— pero en una base nueva se crea de cero DESPUÉS
       * del barrido, y una función nueva nace con `EXECUTE` para `PUBLIC`.
       *
       * O sea que arreglar #68 sin un `revoke` explícito habría abierto en toda
       * base nueva justo lo que #67 vino a cerrar.
       */
      it('y su función no la puede ejecutar nadie de fuera', async () => {
        const { rows } = await client.query<Record<string, boolean>>(
          `select has_function_privilege('public', 'public.rls_auto_enable()', 'EXECUTE') as publico,
                  has_function_privilege('anon', 'public.rls_auto_enable()', 'EXECUTE') as anon,
                  has_function_privilege('authenticated', 'public.rls_auto_enable()', 'EXECUTE')
                    as autenticado`,
        );

        expect(rows[0]).toEqual({ publico: false, anon: false, autenticado: false });
      });
    });

    /**
     * La bóveda de credenciales, que es la tabla con más que perder del
     * proyecto: ahí van a vivir las claves de Yappy, Meta y Resend.
     *
     * Lo que la protege no es una política, es **una ausencia de políticas**.
     * Con RLS activo y cero políticas no pasa ningún rol con sesión, ni siquiera
     * un superadministrador; solo `service_role`, que salta RLS y solo existe en
     * el servidor. Eso es justo lo que alguien «arregla» sin querer el día que
     * quiera mirar la tabla desde el panel, así que se fija aquí.
     */
    it('la bóveda no es alcanzable por ningún rol con sesión', async () => {
      const { rows } = await client.query<Record<string, boolean>>(
        `select has_table_privilege('anon', 'public.integration_credentials', 'SELECT')
                  as anon_lee,
                has_table_privilege('authenticated', 'public.integration_credentials', 'SELECT')
                  as auth_lee,
                has_table_privilege('service_role', 'public.integration_credentials', 'SELECT')
                  as servicio_lee`,
      );

      expect(rows[0]).toEqual({ anon_lee: false, auth_lee: false, servicio_lee: true });
    });

    it('la bóveda sigue con RLS y sin una sola política, que es lo que la cierra', async () => {
      const { rows } = await client.query<{ rls: boolean; politicas: number }>(
        `select c.relrowsecurity as rls,
                (select count(*)::int from pg_policies
                  where schemaname = 'public' and tablename = 'integration_credentials')
                  as politicas
           from pg_class c
           join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public' and c.relname = 'integration_credentials'`,
      );

      expect(rows[0]).toEqual({ rls: true, politicas: 0 });
    });

    /**
     * Las vistas, que es por donde se coló el issue #38.
     *
     * La revocación de la 0033 fue tabla por tabla y no las alcanzó, así que las
     * cinco se quedaron con `INSERT`, `TRIGGER`, `REFERENCES` y `TRUNCATE` para
     * `anon`. No abría nada —tienen `security_invoker=on`, y la RLS de las
     * tablas base sí aplica— pero el invariante escrito decía otra cosa.
     *
     * Se afirma **la lista entera y no vista por vista** a propósito: así una
     * vista nueva que alguien añada sin decidir qué ve el público también rompe
     * este test, en vez de colarse como se coló la última vez.
     */
    it('anon solo lee el catálogo, y no toca ninguna vista de informes', async () => {
      const { rows } = await client.query<{ vista: string; privilegios: string | null }>(
        `select c.relname as vista,
                string_agg(g.privilege_type, ',' order by g.privilege_type) as privilegios
           from pg_class c
           join pg_namespace n on n.oid = c.relnamespace
           left join information_schema.role_table_grants g
             on g.table_schema = 'public'
            and g.table_name = c.relname
            and g.grantee = 'anon'
          where n.nspname = 'public' and c.relkind = 'v'
          group by c.relname
          order by c.relname`,
      );

      expect(rows).toEqual([
        // La tienda la lee sin sesión: quitarle esto es dejarla sin catálogo.
        { vista: 'product_catalog', privilegios: 'SELECT' },
        { vista: 'report_conversion_funnel', privilegios: null },
        { vista: 'report_low_stock', privilegios: null },
        { vista: 'report_sales_daily', privilegios: null },
        { vista: 'report_top_products', privilegios: null },
      ]);
    });
  });

  /**
   * LA RED QUE FALTABA: qué se puede llamar desde fuera, y por qué.
   *
   * De dónde sale
   * -------------
   * De leer `google/adk-samples`, que tiene un `.github/policy.yml` como única
   * fuente de los límites que su CI exige, y validadores que los comparan
   * contra la realidad en vez de contra la intención. Aplicado aquí, la
   * pregunta es: **¿qué funciones de `public` puede ejecutar hoy alguien de
   * fuera, y está cada una en esta lista con su motivo escrito?**
   *
   * Por qué se pregunta a la base y no se lee el código
   * --------------------------------------------------
   * Porque las dos veces que este repositorio tuvo el agujero, el código
   * parecía correcto:
   *
   * - En los issues #9 y #10, funciones nuevas con `EXECUTE` para `PUBLIC`.
   *   Una función nueva nace así, y `revoke ... from anon, authenticated` NO
   *   se lo quita: el permiso no está concedido a esos roles, sino a `PUBLIC`.
   * - En `dashboard_metrics`, la guardia `is_staff()` que puso la migración
   *   0013 y que borró la 0034 al reescribir la función para cambiar los
   *   ingresos de `total` a `amount_paid`. Nada que ver con permisos, y se
   *   llevó uno por delante. Durante cinco días cualquiera que se registrara
   *   como cliente pudo leer la facturación de la tienda por RPC.
   *   Reproducido contra staging antes de arreglarlo.
   * - En `limpiar_lead_intentos`, escrita sin `revoke` en la migración cuyo
   *   asunto era exactamente ese descuido.
   *
   * Tres formas distintas de llegar al mismo sitio. Ninguna se ve leyendo el
   * diff; las tres se ven preguntándole a Postgres.
   *
   * Cómo se añade una entrada
   * -------------------------
   * Si este test falla porque hay una función de más, la pregunta NO es «¿cómo
   * la añado a la lista?». Es «¿tiene que poder llamarla alguien de fuera?».
   * Casi siempre la respuesta es no y lo que falta es el `revoke`. Añadir una
   * entrada es declarar que sí, y el `motivo` es lo que la próxima persona va
   * a leer para decidir si sigue siendo verdad.
   */
  describe('funciones alcanzables desde fuera', () => {
    interface FuncionAlcanzable {
      /** ¿La puede llamar alguien SIN cuenta? */
      anon: boolean;
      /** Por qué se le deja. Lo lee quien audite esto dentro de un año. */
      motivo: string;
    }

    const ALCANZABLES: Record<string, FuncionAlcanzable> = {
      // --- Las siete de identidad -------------------------------------------
      // Las llaman las propias políticas RLS, así que tienen que ser
      // ejecutables por el rol que choca contra la política. Son seguras
      // porque no aceptan argumentos: cada una responde SOLO sobre quien
      // pregunta. `is_admin()` no dice si Fulano es admin, dice si lo eres tú.
      'current_courier_id()': { anon: true, motivo: 'Identidad propia; la usa la RLS de envíos.' },
      'current_customer_id()': {
        anon: true,
        motivo: 'Identidad propia; la usa la RLS del cliente.',
      },
      'current_user_role()': { anon: true, motivo: 'Identidad propia; base de is_staff/is_admin.' },
      'is_admin()': { anon: true, motivo: 'Identidad propia; la usan las políticas de escritura.' },
      'is_courier()': { anon: true, motivo: 'Identidad propia; la usa la RLS del motorizado.' },
      'is_staff()': {
        anon: true,
        motivo: 'Identidad propia; la usan las políticas de lectura del panel.',
      },
      'is_superadmin()': { anon: true, motivo: 'Identidad propia; la usan roles e integraciones.' },

      // --- Las tres con trabajo de verdad -----------------------------------
      'validate_discount(p_code text, p_subtotal numeric, p_customer_id uuid)': {
        anon: true,
        motivo:
          'La tienda comprueba un cupón antes del checkout, y ahí todavía no hay sesión. ' +
          'Endurecida en el issue #8: el límite por persona se resuelve contra la ficha ' +
          'de la sesión, no contra el uuid que llegue por parámetro.',
      },
      'dashboard_metrics(p_days integer)': {
        anon: false,
        motivo:
          'El panel la llama con la sesión de quien mira, que es `authenticated` igual ' +
          'que un cliente. Por eso NO se puede cerrar con privilegios: la guardia ' +
          '`is_staff()` va dentro de la función. Ver el test de aquí abajo.',
      },
      'anonimizar_cliente(p_customer_id uuid)': {
        anon: false,
        motivo:
          'Igual que la anterior: la llama el panel con la sesión de quien pulsa, y la ' +
          'guardia `is_superadmin()` va dentro. Es `security definer` para poder tocar ' +
          'los pedidos y los envíos de otro, así que sin esa guardia cualquier sesión ' +
          'autenticada podría anonimizar a cualquiera. Issue #46.',
      },
    };

    it('no hay ninguna más, y ninguna menos', async () => {
      const { rows } = await client.query<{ firma: string; anon: boolean }>(
        `select p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as firma,
                has_function_privilege('anon', p.oid, 'EXECUTE') as anon
           from pg_proc p
           join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public'
            and p.prosecdef
            -- Una función de disparador no se llama, se dispara: no tiene
            -- superficie de ataque por RPC.
            and p.prorettype <> 'trigger'::regtype::oid
            and (has_function_privilege('anon', p.oid, 'EXECUTE')
                 or has_function_privilege('authenticated', p.oid, 'EXECUTE'))
          order by p.proname`,
      );

      const real = Object.fromEntries(rows.map((r) => [r.firma, { anon: r.anon }]));
      const declarado = Object.fromEntries(
        Object.entries(ALCANZABLES).map(([firma, v]) => [firma, { anon: v.anon }]),
      );

      // Se compara el objeto entero de una vez, a propósito. Comparar solo los
      // nombres dejaría pasar que una función pase de `authenticated` a `anon`
      // sin que nadie se entere, que es medio agujero.
      expect(real).toEqual(declarado);
    });

    /**
     * Y la mitad que no se ve en los privilegios.
     *
     * Las dos funciones con `anon: false` están abiertas a CUALQUIER sesión
     * autenticada, así que su seguridad no está en el `grant` sino en el `if`
     * de su primera línea. Un test de privilegios las da por buenas; solo
     * llamándolas se ve si la guardia sigue ahí.
     *
     * Es exactamente lo que falló: la guardia de `dashboard_metrics` se perdió
     * en un `create or replace` y los privilegios no cambiaron ni un bit.
     */
    it('un cliente registrado no puede leer la facturación de la tienda', async () => {
      await client.query('begin');
      try {
        const { rows } = await client.query<{ id: string }>(
          `insert into auth.users (id, email, raw_user_meta_data)
           values (gen_random_uuid(), 'cliente-metricas@test.local', '{"full_name":"Cliente"}')
           returning id`,
        );
        const cliente = rows[0]!.id;

        // El disparador de alta le pone rol `customer`. Si algún día dejara de
        // hacerlo, este test estaría probando otra cosa.
        const { rows: perfil } = await client.query<{ role: string }>(
          `select role from public.profiles where id = $1`,
          [cliente],
        );
        expect(perfil[0]!.role).toBe('customer');

        await client.query(`select set_config('request.jwt.claim.sub', $1, true)`, [cliente]);

        await expect(client.query('select public.dashboard_metrics(30)')).rejects.toMatchObject({
          code: '42501',
        });
      } finally {
        await client.query('rollback');
      }
    });

    it('y el equipo sí, o el panel se queda sin portada', async () => {
      // La otra mitad. Sin esto, el test de arriba pasaría con una función que
      // rechaza a todo el mundo.
      await client.query('begin');
      try {
        await client.query(`select set_config('request.jwt.claim.sub', $1, true)`, [STAFF]);
        const { rows } = await client.query(`select * from public.dashboard_metrics(30)`);
        expect(rows).toHaveLength(1);
      } finally {
        await client.query('rollback');
      }
    });
  });
});
