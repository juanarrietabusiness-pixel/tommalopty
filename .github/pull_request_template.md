## Qué cambia y por qué

<!-- Dos o tres frases. El "por qué" importa más que el "qué": el diff ya dice qué. -->

## Cómo lo verificaste

<!-- Qué ejecutaste, con qué datos y qué viste. "Funciona en mi máquina" no es verificación. -->

- [ ] `pnpm lint && pnpm typecheck`
- [ ] `pnpm test` (unitarios + RLS)
- [ ] `pnpm test:e2e` si toca la tienda
- [ ] Probado a mano en el navegador

## Impacto

<!-- Marca lo que aplique y explica abajo. -->

- [ ] **Base de datos** — incluye migración
- [ ] **Seguridad** — toca RLS, roles, autenticación o pagos
- [ ] **Dinero** — toca precios, descuentos, stock o checkout
- [ ] **Datos personales** — toca datos de clientes
- [ ] **Rompe compatibilidad** — requiere coordinación al desplegar
- [ ] Ninguno de los anteriores

### Si marcaste base de datos

- [ ] La migración se aplica sobre una base vacía **y** sobre una con datos
- [ ] Es reversible, o está documentado por qué no
- [ ] Tipos regenerados (`pnpm db:types`) y committeados

### Si marcaste seguridad o dinero

- [ ] Hay un test que falla sin este cambio y pasa con él
- [ ] Los importes se calculan en servidor, nunca se aceptan del cliente
- [ ] Ningún secreto nuevo en el código ni en variables `NEXT_PUBLIC_*`

## Capturas

<!-- Obligatorio si cambia algo visible. Móvil y escritorio. -->

## Pendiente / a seguir

<!-- Lo que este PR deja abierto a propósito. Si no hay nada, "nada". -->
