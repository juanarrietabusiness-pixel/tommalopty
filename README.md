# Nébula Commerce

Plataforma e-commerce tipo SaaS: tienda pública, panel de cliente y panel
administrativo con CMS y CRM propios.

El diseño parte del esqueleto HTML aprobado por la clienta, que se conserva
íntegro en [`docs/design-reference/index.html`](docs/design-reference/index.html).
Todo el look & feel se migró tal cual a componentes React: mismos colores,
tipografías, espaciados y comportamiento.

---

## Estructura

```
apps/
  storefront/     Tienda pública + panel de cliente (Next.js, puerto 3000)
  admin/          Panel administrativo + CMS      (Next.js, puerto 3001)
packages/
  ui/             Sistema de diseño: tokens CSS y componentes React
  db/             Cliente Supabase, tipos generados y repositorios
  integrations/   Pasarelas de pago, Meta Conversions API y email
  config/         Presets compartidos de TypeScript y ESLint
supabase/
  migrations/     Esquema SQL y políticas RLS
  seed.sql        Datos de demostración
docs/             Brief, arquitectura, decisiones de pago y guía de despliegue
```

## Puesta en marcha

Requisitos: Node 22+, pnpm 10+, Docker (para Supabase en local).

```bash
pnpm install

# 1. Base de datos local (aplica migraciones y seed)
pnpm db:start

# 2. Variables de entorno
cp .env.example apps/storefront/.env.local
cp .env.example apps/admin/.env.local
#    Pega la URL y las claves que imprime `pnpm db:start`.

# 3. Arrancar
pnpm dev              # ambas apps
pnpm dev:storefront   # solo la tienda
pnpm dev:admin        # solo el panel
```

**Sin Supabase configurado la tienda igual arranca**: usa el contenido de
demostración del esqueleto original, para poder revisar el diseño antes de
conectar la base de datos. El panel, en cambio, sí exige base de datos.

### Crear el primer usuario administrador

Regístrate en la tienda (`/registro`) y luego promociona esa cuenta:

```sql
update public.profiles set role = 'superadmin' where email = 'tu@correo.com';
```

Desde ahí, el resto de roles se gestionan en el propio panel (**Usuarios y roles**).

## Comandos

| Comando          | Qué hace                                               |
| ---------------- | ------------------------------------------------------ |
| `pnpm dev`       | Ambas apps en modo desarrollo                          |
| `pnpm build`     | Build de producción de todo el monorepo                |
| `pnpm lint`      | ESLint en todos los paquetes                           |
| `pnpm typecheck` | TypeScript estricto en todos los paquetes              |
| `pnpm test`      | Tests unitarios (Vitest)                               |
| `pnpm format`    | Prettier sobre todo el repo                            |
| `pnpm db:start`  | Levanta Supabase local                                 |
| `pnpm db:reset`  | Recrea el esquema y vuelve a aplicar el seed           |
| `pnpm db:types`  | Regenera `packages/db/src/generated/database.types.ts` |

## Documentación

- [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md) — decisiones técnicas y cómo encaja cada pieza
- [`docs/PAGOS-PANAMA.md`](docs/PAGOS-PANAMA.md) — por qué no se usa Stripe y qué pasarelas se integran
- [`docs/DESPLIEGUE.md`](docs/DESPLIEGUE.md) — entornos, variables y publicación en Cloudflare
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — fases del proyecto y estado actual
- [`docs/PLAN-LOGISTICA.md`](docs/PLAN-LOGISTICA.md) — trazabilidad, direcciones con mapa, abonos y motorizados
- [`docs/adr/`](docs/adr/) — decisiones de arquitectura y por qué se tomaron
- [`docs/BRIEF.md`](docs/BRIEF.md) — brief original del proyecto, versionado

## Estado

El objetivo actual es **tener la plataforma completa y desplegada**: tienda,
panel y CMS terminados, con la estructura lista para enchufar lo que falte. Que
no haya catálogo real ni pagos activos no lo impide.

Catálogo, carrito, checkout, pedidos, CRM, CMS y reportes están operativos. Lo
que falta por construir y lo que ya funciona, en
[`docs/ROADMAP.md`](docs/ROADMAP.md); el orden de trabajo, en
[`docs/PLAN.md`](docs/PLAN.md).

**Las pasarelas de pago están preparadas pero sin implementar**, a propósito: sus
adaptadores fallan con un mensaje explícito y el checkout no finge cobros. Se
conectan cuando la aplicación esté terminada, y el proveedor lo decide la dueña
de la plataforma — [ADR 0006](docs/adr/0006-pasarela-al-final.md).
