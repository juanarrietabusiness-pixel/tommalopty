# 0004 · Los pedidos se crean en una función de Postgres

**Estado:** aceptada · agosto 2026

## Contexto

La primera versión creaba pedidos desde el route handler: leía variantes,
comprobaba stock, calculaba totales, insertaba el pedido y luego las líneas.
Varias llamadas REST independientes.

Una auditoría encontró que ese diseño tenía seis fallos simultáneos:

1. El stock nunca se descontaba ni se reservaba: la última unidad se vendía
   infinitas veces.
2. Comprobar-y-luego-actuar sin bloqueo: dos compras simultáneas de la última
   unidad pasaban las dos.
3. Dos líneas de la misma variante se validaban por separado: con 5 unidades,
   pedir 5+5 creaba un pedido de 10.
4. Se podían comprar productos en borrador conociendo el UUID de su variante.
5. Si fallaba la inserción de líneas quedaba un pedido con totales y cero
   artículos, ya contabilizado en las métricas del cliente.
6. Los límites de uso de los cupones eran decorativos: nunca se registraba el
   canje.

Ninguno era un descuido aislado. Todos venían de lo mismo: **una operación que
debe ser atómica, ejecutada en pasos separados.**

## Decisión

Los pedidos se crean con `public.create_order()`, una función de PL/pgSQL que
hace todo dentro de una transacción: valida catálogo y stock, bloquea las filas
de inventario (`for update`), agrega las líneas repetidas, calcula totales con
los precios reales, reserva las unidades, crea pedido y líneas, y registra el
canje del cupón.

Es la **única** vía de creación de pedidos. Está revocada de `anon` y
`authenticated`: solo el servidor la invoca.

## Por qué

Postgres ya sabe hacer esto correctamente. El error fue intentar coordinarlo
desde la aplicación, donde no hay transacción que abarque varias llamadas REST.

El resultado colateral: el route handler pasó de 330 a 217 líneas y ya no calcula
nada. La lógica está donde se puede probar de verdad —contra una base real, con
concurrencia— en lugar de con mocks que no reproducen el problema.

## Lo que se acepta a cambio

**Lógica de negocio en SQL.** Menos cómoda de leer para quien viene de
TypeScript, y no la cubre el sistema de tipos.

Se mitiga así: las reglas _puras_ (aritmética de dinero, orden de aplicación de
descuentos, disponibilidad, transiciones de estado) viven en `packages/domain`
con 33 tests unitarios. En SQL queda solo lo que necesita atomicidad y bloqueo.
Ambas implementaciones deben coincidir; si divergen, es un bug.

## Cuándo reconsiderar

Si la función crece hasta ser inmantenible. La señal de alarma sería empezar a
meter ahí reglas que no necesitan atomicidad — esas van a `packages/domain`.
