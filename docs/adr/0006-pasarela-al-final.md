# 0006 · La pasarela de pago se conecta al final, no al principio

**Estado:** aceptada · agosto 2026

## Contexto

Hasta ahora el orden de trabajo daba por sentado que cobrar era lo primero:
`docs/PLAN.md` abría con una "Fase A · Poder cobrar _(bloqueante)_" y todos los
documentos describían la pasarela como el único bloqueante real del proyecto.

Ese orden asumía que el objetivo inmediato era vender. No lo es. El objetivo
inmediato es **tener la plataforma completa y desplegada**: tienda, panel y CMS
funcionando de punta a punta, con toda la estructura lista para enchufar lo que
falte. Un catálogo vacío y sin métodos de pago activos no impide nada de eso.

Además, contratar una pasarela no es una tarea técnica: obliga a elegir
proveedor, firmar con un banco, entregar documentación mercantil y aceptar
comisiones. Es una decisión de negocio con consecuencias contractuales.

## Decisión

**La pasarela de pago se implementa cuando la aplicación esté completa, y su
elección es de la dueña de la plataforma.** No se contrata ni se implementa
ninguna hasta entonces.

Mientras tanto, la prioridad es que estén terminados y desplegados:

- la tienda pública,
- el panel administrativo,
- el CMS,

con la estructura preparada para conectar pasarela, catálogo real y contenido
definitivo sin rehacer nada.

## Por qué

**Salir a producción no depende de cobrar.** Una plataforma desplegada, aunque
sea con catálogo de demostración, se puede enseñar, revisar, medir y corregir.
Una plataforma en un portátil, no. Cuanto antes esté en un entorno real, antes
aparecen los problemas que solo aparecen ahí.

**Lo que bloquea de verdad es lo que no existe.** Un adaptador de pago sin
credenciales es una decisión pendiente; una pantalla del panel que no está
construida es trabajo pendiente. Lo segundo se puede hacer hoy y lo primero no.

**La estructura ya está preparada para recibirla.** Las cuatro pasarelas tienen
su adaptador con la interfaz completa, el registro las descubre por variable de
entorno, el checkout habla solo con esa interfaz y el handler de webhooks está
escrito y verificado. Conectar la primera es rellenar cuatro métodos, no
rediseñar el flujo de compra.

**Elegir pasarela antes de tiempo cuesta dinero.** Las comisiones y condiciones
dependen del volumen y del catálogo reales. Decidir con la tienda terminada
delante es una decisión mejor informada que decidirla ahora.

## Lo que se acepta a cambio

**La tienda no puede cobrar, y hay que decirlo con claridad.** El checkout ya
degrada con honestidad: crea el pedido, lo deja pendiente, registra el evento y
responde 501 con un mensaje explícito. No finge cobros. Antes de enseñar la
plataforma a nadie de fuera hay que dejar claro que los métodos de pago están
preparados pero no activos.

**El camino de pago no se ejercita hasta el final.** El descuadre de importe del
webhook, la captura y los reembolsos están escritos y probados con tests, pero
ninguno se habrá ejecutado contra una pasarela real hasta entonces. La primera
integración necesita una ronda completa en sandbox, reembolsos incluidos.

**Los reembolsos desde el panel siguen bloqueados**, porque dependen de la
pasarela. Hasta entonces se gestionan desde el panel del proveedor.

## Lo que NO cambia

Esta decisión aplaza la pasarela, no la calidad de lo que la rodea:

- El importe cobrado se sigue comparando contra el total del pedido antes de
  marcar nada como pagado. El campo `amount` de `WebhookVerification` es
  requerido a propósito, para que ningún adaptador futuro se lo salte.
- Las reservas de stock siguen caducando. El único motivo por el que hoy no
  muerde es que ningún pedido puede avanzar a pagado, y eso cambiará.
- Las páginas legales siguen siendo requisito de lanzamiento. Se necesitan igual
  para publicar, y además serán lo primero que revise el proveedor de pago el día
  que se contrate.

## Cuándo reconsiderar

Cuando la dueña de la plataforma decida contratar. A partir de ahí manda la
Fase A de [`docs/PLAN.md`](../PLAN.md), que se conserva íntegra para ese momento.

Si antes de eso apareciera una necesidad real de cobrar —una preventa, un piloto
con clientes—, esta decisión se revierte sin coste: nada de lo construido asume
que no habrá pasarela.
