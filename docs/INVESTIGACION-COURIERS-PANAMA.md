# Investigación · Couriers y logística en Panamá

Qué se puede integrar de verdad, con qué esfuerzo, y qué hay que negociar antes
de escribir código. Alimenta la [Fase L5](PLAN-LOGISTICA.md) del plan.

**Fecha:** agosto de 2026. **Confirmar antes de comprometer nada:** estas
empresas cambian endpoints y condiciones comerciales sin avisar, y buena parte
de lo de aquí sale de documentación de terceros, no de un portal oficial.

---

## El resumen, en una tabla

| Proveedor                 | Qué aporta                                                           | ¿API pública?                    | ¿Se puede empezar hoy?                                |
| ------------------------- | -------------------------------------------------------------------- | -------------------------------- | ----------------------------------------------------- |
| **Dropi PA**              | 4 couriers panameños + pago contra entrega, con una sola integración | Sí, documentada                  | **Sí — es por donde hay que empezar**                 |
| **DHL Express**           | Internacional, la mejor documentación de todas                       | Sí, portal oficial autoservicio  | Sí, con cuenta DHL activa                             |
| **Shippea / Uno Express** | La mayor red de couriers de Panamá                                   | No publicada                     | No: hay que hablar con ellos                          |
| **Servientrega**          | Cobertura nacional, la marca que pidió la clienta                    | Sí, pero anticuada y fragmentada | No: exige cuenta corporativa                          |
| **EasyPost / Shippo**     | Agregadores internacionales                                          | Sí                               | **No sirve**: en Panamá solo llegan vía DHL/FedEx/UPS |

---

## 1. Dropi PA — el hallazgo más importante

Cuando la clienta dijo «Droppy», casi con seguridad hablaba de
**[Dropi](https://dropi.pa)**, plataforma de logística y e-commerce con
operación en Panamá (y en Colombia, Paraguay y otros países de la región).

**Por qué es la mejor puerta de entrada:**

- **Un adaptador, cuatro couriers.** Dropi PA ya integra Servientrega Panamá,
  Cargo Expreso, Correos de Panamá y Caribbean Express. Integrar Dropi es
  integrar los cuatro de golpe, sin negociar cuatro contratos ni escribir cuatro
  adaptadores.
- **Pago contra entrega de serie.** Es el modelo central de Dropi, no un añadido.
  Y enlaza directo con lo que más preocupa a la clienta: los abonos (Fase L3) y
  la liquidación de los motorizados (Fase L4).
- **Tiene API documentada.** Autenticación por cabecera `dropi-integration-key`,
  que se genera desde el propio panel de Dropi en su apartado de Integraciones.
  Cubre creación de órdenes y obtención de guías, y tiene **entorno de pruebas
  separado del de producción** — que es justo lo que faltaba para poder estimar
  la fase con seriedad.

**Lo que hay que confirmar con ellos antes de escribir nada:**

1. Que la documentación de la API aplica a la operación de **Panamá** y no solo a
   la de Colombia. La documentación que circula usa `cod_dane` para la ciudad de
   destino, y el DANE es el organismo estadístico **colombiano**: en Panamá ese
   campo tiene que ser otra cosa. Es la primera pregunta que hay que hacerles.
2. Si hay webhooks de cambio de estado, o si el seguimiento obliga a consultar
   por sondeo. Cambia bastante el diseño de la Fase L2.
3. Condiciones comerciales del contra entrega: cuándo liquidan el dinero
   cobrado, con qué comisión y con qué corte.

**Riesgo:** la documentación pública circula en Scribd, no en un portal oficial
de desarrolladores. Eso suele significar que la API existe y funciona, pero que
no hay compromiso de estabilidad ni versionado. El adaptador debe asumir que
puede romperse sin aviso.

---

## 2. Servientrega — la marca que pidió la clienta, y la más enredada

Hay que separar dos cosas que se confunden:

**Servientrega Panamá ([servientrega.com.pa](https://servientrega.com.pa)) es una
entidad distinta de Servientrega Colombia.** Tiene su propio sitio y su propio
cotizador. Casi toda la documentación e integraciones que se encuentran en
internet son **de Colombia**, y no hay garantía de que sirvan aquí. Asumir que sí
es el error más caro que se puede cometer en esta fase.

**Conviven dos generaciones de API:**

|           | Antigua                                               | Nueva                                                 |
| --------- | ----------------------------------------------------- | ----------------------------------------------------- |
| Protocolo | SOAP                                                  | REST, JSON                                            |
| Endpoint  | `web.servientrega.com:8081/GeneracionGuias.asmx?wsdl` | `mobile.servientrega.com/ApiIngresoCLientes` (v1.0.2) |
| Cubre     | Generación de guías                                   | Cotización                                            |

**Dos detalles técnicos que importan para este proyecto:**

- **El puerto 8081 no es un problema.** Lo parecía: los Workers de Cloudflare
  restringían los puertos de salida. Pero la bandera `allow_custom_ports` es el
  comportamiento por defecto desde la fecha de compatibilidad 2024-09-02, y este
  proyecto está en 2026-08-01. Hacia un destino que no esté detrás de Cloudflare,
  se puede usar cualquier puerto.
- **Lo que sí es un problema es que sea `http://` y no `https://`.** Mandar
  credenciales por HTTP plano no es aceptable, y no lo arregla ninguna
  configuración nuestra. Si el endpoint de Panamá tiene el mismo defecto, hay que
  exigirles HTTPS o meter un proxy propio delante.
- **SOAP desde un Worker significa construir el XML a mano.** Las librerías SOAP
  de Node no corren en el runtime de Workers. Es viable, pero es trabajo real y
  hay que contarlo en la estimación.

**Para obtener credenciales hace falta cuenta corporativa aprobada**, así que no
es autoservicio: es una conversación comercial primero.

---

## 3. Shippea / Uno Express — la red más grande, la puerta más cerrada

[Uno Express](https://unoexpresspanama.com) es la mayor red de couriers de
Panamá, con más de 20 años operando, y **[Shippea](https://www.shippea.io) es su
plataforma tecnológica**.

Lo que ofrece —según su ficha de Shopify— es exactamente lo que necesita la Fase
L2: tarifas reales en el checkout, generación automática de guías, sincronización
de pedidos y avisos automáticos al cliente en cada etapa del envío.

**El problema:** no publican documentación de API. Existe la app de Shopify, pero
nada para una plataforma propia. Hay que preguntarles directamente si exponen API
para integradores. Si la respuesta es que no, la única vía sería usar su panel a
mano — que es justo lo que el campo de guía manual de la Fase L2 ya cubre.

---

## 4. DHL Express — la única con documentación seria y autoservicio

**MyDHL API**, en [developer.dhl.com](https://developer.dhl.com/api-catalog).
REST con OAuth 2, portal de desarrolladores propio, catálogo de APIs separadas
(envíos y seguimiento, rastreo de paquetes, generación de etiquetas), y
credenciales que se sacan del portal una vez aprobado el acceso a producción.

**Requisito:** cuenta de cliente activa con DHL Express.

Es la mejor documentada de todas con diferencia, y la más rápida de integrar. No
sustituye al reparto local —su fuerte es el internacional— pero si la tienda
vende fuera de Panamá, es la primera que conviene conectar por relación
esfuerzo/resultado.

---

## 5. Los agregadores internacionales no sirven aquí

**EasyPost** y **Shippo** son la solución obvia en Estados Unidos: un contrato,
decenas de transportistas. En Panamá **no resuelven el problema**.

Shippo cubre envíos internacionales mediante DHL Express, FedEx y UPS. Es decir:
llega a Panamá, pero **no hace la última milla dentro de Panamá con couriers
locales**. Para el reparto en ciudad —que es el caso de la clienta— no aportan
nada que no dé DHL directamente, y añaden un intermediario y su comisión.

**Conclusión:** el agregador que sirve para Panamá es Dropi, no los americanos.

---

## 6. Qué hay en GitHub: prácticamente nada reutilizable

Se buscaron clientes de API, plugins y librerías para estos proveedores. El
resultado es escaso y conviene saberlo antes de estimar:

| Lo que hay                                                                                            | Qué es                                             | ¿Sirve?                                                                                                    |
| ----------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| [`saulmoralespa/shipping-servientrega-wc`](https://github.com/saulmoralespa/shipping-servientrega-wc) | Plugin de WooCommerce, PHP, SOAP contra el `:8081` | **Como referencia, sí; como código, no.** Es PHP, y su propio README dice «actualmente solamente Colombia» |
| App de Servientrega para Shopify                                                                      | Cotización y etiquetas                             | Solo dentro de Shopify                                                                                     |
| App de Shippea para Shopify                                                                           | Uno Express                                        | Solo dentro de Shopify                                                                                     |
| Clientes Node/TypeScript de cualquiera de estos couriers                                              | —                                                  | **No existen**                                                                                             |

**Lo que esto significa para el plan:** no hay atajo. La Fase L5 es escribir los
adaptadores, no instalar una dependencia. El plugin de WooCommerce vale para leer
cómo se llama a Servientrega y qué campos espera, y ahí se acaba su utilidad.

La parte buena es que el diseño de la Fase L5 no cambia: la interfaz de cuatro
operaciones —cotizar, crear guía, rastrear, recibir webhook— es exactamente la
forma correcta, y es la que hace que dé igual quién esté detrás.

---

## 7. Recomendación

**Orden de integración, por relación esfuerzo/resultado:**

1. **Dropi PA primero.** Un adaptador, cuatro couriers panameños y el pago contra
   entrega que la clienta necesita. Es el único que resuelve el caso central del
   negocio de una sola vez.
2. **DHL Express después**, si vende fuera de Panamá. Documentación pública,
   autoservicio, la más rápida de las cinco.
3. **Shippea y Servientrega directo, solo si la conversación comercial va bien.**
   Ninguno de los dos se puede empezar sin contrato, y Servientrega además obliga
   a escribir SOAP a mano. Mientras tanto, el campo de guía manual de la Fase L2
   cubre el caso «lo mandamos por Servientrega y pegamos el número» sin
   integración ninguna.
4. **Los agregadores americanos, descartados** para el reparto local.

**Lo que hay que preguntar, y a quién:**

| A quién               | Qué                                                                                                             |
| --------------------- | --------------------------------------------------------------------------------------------------------------- |
| Dropi PA              | ¿La API aplica a Panamá? ¿Qué sustituye a `cod_dane`? ¿Hay webhooks? ¿Cómo y cuándo liquidan el contra entrega? |
| Shippea / Uno Express | ¿Existe API para integradores fuera de Shopify?                                                                 |
| Servientrega Panamá   | ¿Qué API dan: la SOAP o la REST? ¿Está en HTTPS? ¿Hay entorno de pruebas?                                       |
| DHL Express           | Nada: la documentación está publicada. Solo hace falta cuenta.                                                  |

**Una consecuencia de negocio que conviene ver ahora, no en la Fase L5.** Si se
usa contra entrega —con Dropi o con los motorizados propios— el dinero de las
ventas pasa por manos de terceros antes de llegar a la clienta. Eso obliga a que
la plataforma sepa, en todo momento, **cuánto dinero hay cobrado pero todavía no
liquidado, y quién lo tiene**. No es una pantalla más: es una cuenta por cobrar.
Conviene decidirlo al diseñar los abonos (Fase L3), porque después cuesta mucho
más meterlo.

---

## Fuentes

- [Dropi Panamá](https://dropi.pa) · [Integraciones (Dropi Colombia)](https://dropi.co/integraciones/)
- [Documentación API de Integraciones Dropi](https://es.scribd.com/document/804372978/Integrations-Core-Dropi-2) (no oficial)
- [Servientrega Panamá](https://servientrega.com.pa/Cotizador) · [Soluciones eCommerce](https://www.servientrega.com/wps/portal/soluciones-ecommerce) · [API de cotización](https://mobile.servientrega.com/ApiIngresoCLientes/Help)
- [`saulmoralespa/shipping-servientrega-wc`](https://github.com/saulmoralespa/shipping-servientrega-wc)
- [Integración con Servientrega (Simla)](https://docs.simla.com/es/Users/Integration/DeliveryServices/ServiEntrega/IntegracionConServientrega)
- [Shippea](https://www.shippea.io/) · [Uno Express Panamá](https://unoexpresspanama.com/)
- [MyDHL API](https://developer.dhl.com/api-reference/dhl-express-mydhl-api) · [Catálogo de APIs de DHL](https://developer.dhl.com/api-catalog)
- [Carriers de Shippo](https://goshippo.com/carriers) · [Carriers de EasyPost](https://www.easypost.com/carriers/)
- [Banderas de compatibilidad de Cloudflare Workers](https://developers.cloudflare.com/workers/configuration/compatibility-flags/) (`allow_custom_ports`)
