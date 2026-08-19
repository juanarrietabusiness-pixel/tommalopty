# Despliegue

## Entornos

| Entorno    | Rama      | Supabase                        | Pasarelas  |
| ---------- | --------- | ------------------------------- | ---------- |
| Desarrollo | local     | Supabase local (Docker)         | sandbox    |
| Staging    | `develop` | Proyecto Supabase de staging    | sandbox    |
| Producción | `main`    | Proyecto Supabase de producción | producción |

Cada entorno tiene **su propio juego de variables y credenciales**. Nunca
compartir la service-role key ni las claves de pasarela entre entornos.

## Variables de entorno

Los nombres exactos están en [`.env.example`](../.env.example). Reglas:

- `NEXT_PUBLIC_*` se incrusta en el bundle del navegador. Solo valores públicos.
- `SUPABASE_SERVICE_ROLE_KEY` **salta RLS**: solo en servidor, nunca en el
  cliente ni en logs.
- Las claves de pasarelas de pago, Meta y email viven en el secret store del
  hosting. La tabla `integrations` solo guarda el interruptor de activación y
  configuración no sensible.

## Base de datos

Las migraciones son la fuente de verdad del esquema. Se aplican en orden:

```bash
# Enlazar el proyecto (una sola vez por entorno)
supabase link --project-ref <ref-del-proyecto>

# Aplicar migraciones pendientes
supabase db push

# Regenerar los tipos después de cambiar el esquema
pnpm db:types
```

Nunca editar el esquema a mano desde el panel de Supabase: se pierde la
trazabilidad y el siguiente `db push` puede chocar. Crear siempre una migración.

**Backups:** activar los backups automáticos de Supabase y definir la política
de retención antes de abrir la tienda al público.

## Publicación en Cloudflare

Las dos apps se despliegan por separado (dos proyectos de Cloudflare Workers),
cada una con su dominio:

- `storefront` → dominio principal de la tienda
- `admin` → subdominio propio (p. ej. `panel.tudominio.com`)

Recomendado además para el panel: restringir el acceso con Cloudflare Access,
de modo que ni siquiera se llegue a la pantalla de login desde fuera del equipo.

### Build

Las apps usan el adaptador [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare):

```bash
pnpm --filter @nebula/storefront cf:build      # genera el bundle de Workers
pnpm --filter @nebula/storefront cf:preview    # pruébalo en local con workerd
pnpm --filter @nebula/storefront cf:deploy     # publica
```

Y lo mismo con `@nebula/admin`.

> El adaptador requiere una cuenta de Cloudflare autenticada (`wrangler login`)
> para `cf:deploy`. Los comandos `cf:*` no forman parte de CI: el pipeline valida
> con `next build`, que es lo que detecta errores de código.

### Por qué las apps usan `middleware.ts` y no `proxy.ts`

Next 16 marca `middleware.ts` como obsoleto a favor de `proxy.ts`, pero `proxy`
solo corre en runtime Node y `@opennextjs/cloudflare` todavía no lo soporta
(falla con _"Node.js middleware is not currently supported"_). Como el hosting
elegido es Cloudflare, las dos apps se quedan en `middleware.ts` —que compila a
edge y sí despliega— hasta que el adaptador añada soporte. El aviso de
deprecación durante el build es esperado.

### Configuración por app

Cada app tiene su `wrangler.jsonc` con:

- `name` — el proyecto de Cloudflare al que despliega
- `compatibility_flags: ["nodejs_compat"]` — necesario para el runtime de Next
- variables públicas en `vars`

Los secretos **no van en `wrangler.jsonc`** (está en git). Se cargan con:

```bash
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put PAYPAL_CLIENT_SECRET
# …
```

## Almacenamiento de imágenes

El catálogo sirve las imágenes desde Cloudflare R2 (egress $0) o Supabase
Storage. Una vez definido el dominio público:

1. Añádelo a `NEXT_PUBLIC_R2_PUBLIC_URL`.
2. Añádelo a `images.remotePatterns` en el `next.config.ts` de la tienda si se
   quiere pasar a `next/image`. Hoy se usa `<img>` a propósito, porque el
   dominio varía por entorno.

## CI/CD

[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) ejecuta en cada PR:

1. `pnpm format:check` — formato
2. `pnpm lint` — ESLint
3. `pnpm typecheck` — TypeScript estricto
4. `pnpm test` — tests unitarios
5. `pnpm build` — build de producción de ambas apps
6. Un job aparte levanta Supabase y comprueba que las migraciones aplican
   limpias, incluido el linter de esquema (detecta tablas sin RLS).

## Lista de comprobación antes de producción

- [ ] Pasarelas de pago implementadas y probadas en sandbox
- [ ] Webhooks apuntando al dominio de producción y con firma verificada
- [ ] Backups automáticos de Supabase activos, con retención definida
- [ ] Panel protegido con Cloudflare Access
- [ ] Al menos un `superadmin` creado y los roles del equipo asignados
- [ ] Contenido real: catálogo, banners, páginas legales
- [ ] Meta Pixel y Conversions API verificados en el Events Manager
- [ ] Emails transaccionales enviando desde un dominio verificado
- [ ] Revisada la política de envíos y devoluciones con la clienta
