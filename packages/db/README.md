# @nebula/db

Acceso a Supabase: clientes, tipos y repositorios.

## Los tres clientes, y cuál usar

| Cliente                               | Dónde                                      | RLS                |
| ------------------------------------- | ------------------------------------------ | ------------------ |
| `createSupabaseBrowserClient()`       | Componentes de cliente                     | Sí                 |
| `createSupabaseServerClient(cookies)` | Server Components, Actions, Route Handlers | Sí                 |
| `createSupabaseServiceClient()`       | Solo servidor                              | **No — salta RLS** |

El de service-role es la excepción, no la norma. Se usa únicamente donde no hay
una sesión que pueda autorizar la operación:

- webhooks de las pasarelas de pago,
- creación de pedidos (incluidas compras de invitado),
- alta de leads desde la newsletter.

El panel administrativo **no** lo usa: trabaja con el cliente ligado a la sesión
del operador, de modo que RLS sigue siendo la barrera real.

`createSupabaseServerClient` recibe un adaptador de cookies en lugar de importar
`next/headers`, para que el paquete también funcione en Workers y Edge Functions.

## Tipos

`src/generated/database.types.ts` refleja el esquema real: 34 tablas, 5 vistas,
12 enums y las relaciones de claves foráneas (lo que permite tipar los `select`
anidados). **No se edita a mano.** Tras cambiar el esquema:

```bash
pnpm db:types
```

Helpers: `Tables<'products'>`, `TablesInsert<'orders'>`, `Views<'product_catalog'>`,
`Enums<'order_status'>`.

## Repositorios

Funciones que reciben el cliente y devuelven datos ya normalizados:

- `catalog.ts` — listado, búsqueda, ficha de producto, categorías
- `cms.ts` — banners, menús, páginas, ajustes públicos
- `orders.ts` — listado y ficha de pedido, bitácora, pagos
- `customers.ts` — CRM y datos del cliente autenticado
- `reports.ts` — KPIs y vistas de reporte

Nada aquí asume Next.js: reciben el cliente como parámetro.
