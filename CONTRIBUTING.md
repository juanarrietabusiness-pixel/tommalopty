# Cómo se trabaja en este repositorio

Este documento son reglas, no sugerencias. Existen porque la plataforma maneja
dinero y datos personales de clientes reales: un error aquí no es un bug, es una
pérdida.

---

## Antes de escribir código

1. **Lee [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md)**, sobre todo la sección
   de RLS. Muchos errores caros nacen de no entender que la seguridad vive en la
   base de datos, no en la interfaz.
2. **Mira si ya existe.** Las reglas de negocio van en `packages/domain`, el
   acceso a datos en `packages/db`, los componentes en `packages/ui`. Si vas a
   calcular un precio, ya hay una función para eso.

## Ramas

```
main                    Producción. Protegida. Solo se entra por PR aprobado.
develop                 Staging. Se despliega solo.
feat/<descripcion>      Funcionalidad nueva
fix/<descripcion>       Corrección
chore/<descripcion>     Mantenimiento, dependencias, tooling
db/<descripcion>        Cambios de esquema (ver abajo, tienen reglas propias)
```

Ramas cortas. Una rama que vive dos semanas es una rama que va a dar conflictos
y a esconder problemas.

## Commits

[Conventional Commits](https://www.conventionalcommits.org/es/), en español:

```
feat(storefront): filtro por rango de precio en el catálogo
fix(checkout): el descuento se aplicaba dos veces al recargar
db(pedidos): índice sobre orders.email para la búsqueda del panel
```

El cuerpo explica **por qué**. El diff ya explica qué.

## Qué bloquea un merge

CI ejecuta esto en cada PR y **todo tiene que estar en verde**:

| Comprobación        | Qué detecta                                |
| ------------------- | ------------------------------------------ |
| `pnpm format:check` | Formato inconsistente                      |
| `pnpm lint`         | Errores de ESLint                          |
| `pnpm typecheck`    | TypeScript estricto en los 7 paquetes      |
| `pnpm test`         | Unitarios + RLS contra Postgres real       |
| `pnpm test:e2e`     | Flujo de compra + WCAG 2.1 AA en 3 tamaños |
| `pnpm build`        | Build de producción de ambas apps          |
| Migraciones         | Que el esquema aplique limpio desde cero   |

Cuando terminan, un comentario en el PR resume el estado de todo en una tabla.

Además, **a mano**:

- Una aprobación de otra persona. Dos si el PR toca pagos, RLS o datos de
  clientes.
- **Abrir el enlace de previsualización** que el bot comenta en el PR y mirar el
  cambio de verdad. Las capturas automáticas de móvil, tablet y escritorio
  también quedan adjuntas.
- Sin `TODO` nuevos sin issue asociado.

**No se mergea con CI en rojo.** Ni "es un fallo intermitente", ni "lo arreglo
después". Si el test falla de forma intermitente, eso es un bug del test y se
arregla en su propio PR.

## Reglas que no se negocian

Estas salieron de fallos reales encontrados en auditoría. No son teoría.

### Dinero

- **Los importes se calculan en servidor, siempre.** Lo que manda el navegador
  dice _qué_ y _cuántos_, nunca _cuánto cuesta_.
- Nada de aritmética de dinero con `number` suelto: usa `packages/domain/money`.
  `0.1 + 0.2` no es `0.3`.
- El estado de un pago lo decide el webhook de la pasarela, nunca la vuelta del
  navegador.

### Seguridad

- **RLS es por fila, no por columna.** Una política que deja editar "tu propia
  fila" deja editar _todas sus columnas_, incluido el rol. Si una columna es
  sensible, protégela con un trigger.
- **Nunca uses el cliente service-role donde hay una sesión.** Salta RLS. Solo
  para webhooks, creación de pedidos y tareas sin usuario.
- **Nada de identificadores secuenciales como credencial.** Si una URL da acceso
  a datos, lleva un token opaco.
- Ningún secreto en variables `NEXT_PUBLIC_*`. Se incrustan en el bundle.
- Datos de tarjeta: no se reciben, no se almacenan, no se registran. Nunca.

### Base de datos

- **El esquema se cambia solo con migraciones.** Editar a mano desde el panel de
  Supabase rompe la trazabilidad y el siguiente despliegue.
- Toda operación que toque varias tablas y deba ser consistente va en una
  función de Postgres, no en varias llamadas desde la app.
- Tras cambiar el esquema: `pnpm db:types` y committea el resultado.
- Toda tabla nueva nace con RLS activo y su política. Sin excepción.

### Accesibilidad y rendimiento

- Contraste mínimo 4.5:1 en texto. Hay una variante accesible del naranja de
  marca para eso.
- Todo lo interactivo se usa con teclado. Un panel cerrado lleva `inert`.
- Cada página, un `h1`.
- Si añades una dependencia al bundle de cliente, justifícalo en el PR.

## Cambios de base de datos

Tienen su propio ritual porque son lo único que no se puede revertir con un
`git revert`:

1. Crea la migración: `supabase migration new <descripcion>`.
2. Escríbela **idempotente** (`if not exists`, `drop ... if exists`).
3. Pruébala sobre base vacía **y** sobre una copia con datos.
4. Si es destructiva (borra columnas o tablas), pártela en dos despliegues:
   primero dejar de usarla, luego borrarla.
5. Regenera tipos y añade un test de RLS si toca permisos.

## Revisar un PR

Revisar es leer buscando lo que puede salir mal, no aprobar por cortesía.

- ¿Puede el cliente manipular algo que el servidor da por bueno?
- ¿Esto funciona con 100.000 productos y un millón de pedidos, o solo con diez?
- ¿Hay un test que falle si alguien deshace este cambio?
- ¿Qué pasa si esta consulta devuelve `null`, o la red se cae a la mitad?

Si algo no se entiende, no es que el revisor no sepa: es que falta un comentario.

## Levantar el proyecto

Está en el [README](README.md). Si algo de ahí no funciona, eso es un bug del
README y se arregla — no se resuelve por Slack.
