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
  { nombre: 'los pedidos', sql: 'select id, order_number, total from public.orders limit 1' },
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

describeSiHayBase('permisos de tabla', () => {
  let client: Client;

  beforeAll(async () => {
    client = await connect();
  });

  afterAll(async () => {
    if (client) await client.end();
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
        const error = await asRole(client, { role: 'authenticated' }, async (c) => {
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
});
