# 0003 · La seguridad vive en RLS, no en la aplicación

**Estado:** aceptada · agosto 2026

## Contexto

La plataforma tendrá varias interfaces sobre los mismos datos: tienda pública,
panel de cliente, panel administrativo y, previsiblemente, una API para
integraciones y una app móvil. Cada una podría implementar sus propios controles
de acceso.

## Decisión

Las reglas de acceso se declaran **una sola vez, en políticas de Row Level
Security de Postgres**. Cualquier cliente que se conecte —hoy o dentro de tres
años— queda sujeto a ellas.

Consecuencias operativas:

- El panel administrativo usa el cliente ligado a la sesión del operador, **no**
  el de service-role. Si la interfaz ofreciera por error una acción que su rol no
  permite, la base de datos la rechaza igual.
- El cliente service-role se reserva a operaciones sin sesión que las autorice:
  webhooks de pago, creación de pedidos (incluye compras de invitado) y tareas
  internas.
- Toda tabla nueva nace con RLS activo y su política.

## Por qué

Un control de acceso implementado en la aplicación hay que reimplementarlo en
cada interfaz nueva, y basta olvidarlo una vez para abrir una fuga. En la base de
datos se escribe una vez y protege a todos.

Además, es **verificable**: `packages/db/src/__tests__/rls.test.ts` ejecuta 26
comprobaciones contra un Postgres real, suplantando cada rol. Esos tests
encontraron una escalada de privilegios que la revisión manual no vio.

## Lo que se acepta a cambio

**RLS es a nivel de fila, no de columna.** Una política que autoriza "editar tu
propia fila" autoriza editar _todas sus columnas_. Fue exactamente el fallo
detectado: la política de perfil propio permitía cambiarse el rol a
superadministrador.

Las columnas sensibles se protegen con **triggers** (`guard_profile_privileges`,
`guard_customer_identity`) o con `GRANT` por columna. Es una capa extra que hay
que recordar; el precio de que la seguridad sea declarativa.

**Un UPDATE filtrado por RLS no da error: afecta a cero filas y devuelve éxito.**
Las mutaciones deben comprobar filas afectadas si necesitan confirmar que
escribieron.

## Cuándo reconsiderar

Si el rendimiento de las políticas se vuelve el cuello de botella. Antes de
abandonarlas, envolver las funciones auxiliares en subconsultas
—`(select public.is_staff())`— para que Postgres las evalúe una vez y no por
fila.
