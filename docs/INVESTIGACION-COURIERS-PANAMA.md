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
| **Servientrega Panamá**   | Cobertura nacional, la marca que pidió la clienta                    | Sí, y con librería de referencia | **Sí** — hay sandbox y hay código que leer            |
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

## 2. Servientrega Panamá — corregido: es más accesible de lo que parecía

> **Esta sección estaba mal en la primera versión de este documento.** La
> escribí con la documentación de Servientrega **Colombia**, que es la que sale
> al buscar. Servientrega Panamá funciona de otra manera, y mejor. Lo que sigue
> sale de leer el código de una librería específica de Panamá
> ([`saulmoralespa/servientrega-webservice-panama-php`](https://github.com/saulmoralespa/servientrega-webservice-panama-php),
> MIT, PHP 8.1, última actualización enero de 2025).

**No usa `web.servientrega.com:8081`.** Eso es Colombia. Panamá está operado por
un tercero, `appsiscore.com`, **todo sobre HTTPS en el puerto 443**:

| Operación    | Endpoint                                                             | Protocolo              |
| ------------ | -------------------------------------------------------------------- | ---------------------- |
| Cotizar      | `https://ws-servientrega.appsiscore.com/cotizador/ws_cotizador.php`  | **POST con JSON**      |
| Generar guía | `https://ws-servientrega.appsiscore.com/generar_guia_carta.php?wsdl` | SOAP (método `getXML`) |
| Rastrear     | `https://ws-servientrega.appsiscore.com/server_wst.php?wsdl`         | SOAP (método `getXML`) |
| **Sandbox**  | `https://ws-servientrega.appsiscore.com/test/`                       | Igual, contra pruebas  |

**Sí hay entorno de pruebas.** Es lo que en el plan faltaba para poder estimar la
fase con seriedad.

**Autenticación:** usuario y contraseña, dentro del cuerpo de la petición
(`usuingreso`/`contrasenha` en la cotización, `usu`/`pwd` en SOAP). No hay OAuth
ni cabeceras: son credenciales de larga vida, así que van al secret store del
Worker y nunca al repositorio.

### Lo que esto cambia para nosotros

- **La cotización es JSON sobre HTTPS.** Se llama desde un Worker con un `fetch`
  normal. Cero fricción.
- **Guía y rastreo son SOAP, pero sobre HTTPS/443.** Hay que construir el sobre
  XML a mano, porque las librerías SOAP de Node no corren en Workers. Es trabajo
  acotado —dos operaciones, un solo método `getXML`— pero hay que contarlo.
- **Mis dos advertencias anteriores no aplican a Panamá.** Ni el puerto 8081 ni
  el `http://` en claro: aquí es HTTPS estándar. Quedan como aviso solo para
  quien intente usar la documentación colombiana.

### Tres hallazgos del contrato que afectan al plan entero

**1. La guía acepta `latitud` y `longitud`.** Esto es lo más importante del
documento. Significa que **el courier nacional consume coordenadas**, no solo los
motorizados propios. La [Fase L1](PLAN-LOGISTICA.md) —poner la dirección en un
mapa— deja de ser una mejora de la experiencia de compra y pasa a ser un
requisito de la integración: sin coordenadas se le entrega a Servientrega una
guía peor de lo que su propia API admite.

**2. La guía acepta `valor_recaudar`.** Servientrega Panamá hace **contra entrega
de forma nativa**, en el mismo campo de la guía. Enlaza directo con los abonos de
la [Fase L3](PLAN-LOGISTICA.md): un pedido con saldo pendiente puede despacharse
poniendo el saldo en ese campo y que el courier lo cobre.

**3. No hay código postal.** El destino se indica con `provincia_destinatario` y
`distrito_destinatario`, **por nombre y en texto** (`"PANAMA"`, `"CHIRIQUI"`).
Confirma lo que ya suponía el plan sobre las direcciones panameñas, y añade un
trabajo concreto: hay que mantener la lista de provincias y distritos tal y como
Servientrega los escribe, porque un nombre que no coincida es una guía rechazada.

Otros campos del contrato: `nombre_producto` / `servicio` con valores como
`PREMIER-RESIDENCIAL` o `PREMIER-CDS A CDS`; `transporte` (`TERRESTRE`); peso y
dimensiones; `valor_declarado`; `mail_destinatario`, con lo que el courier avisa
por su cuenta; y `fecha_programacion`.

**Un detalle práctico que solo se ve leyendo el código:** la librería limpia los
bytes de control de la respuesta antes de parsear el JSON
(`preg_replace('/[\x00-\x1F\x80-\xFF]/', ...)`). Es decir, **la API devuelve
JSON sucio**. Nuestro adaptador tendrá que hacer lo mismo o fallará a parsear sin
motivo aparente.

**Lo que no pude comprobar:** el proxy de salida de este entorno deniega por
política las conexiones a `ws-servientrega.appsiscore.com`, así que no verifiqué
que los endpoints respondan hoy. El dominio sí resuelve por DNS. Es una
limitación de mi entorno, no una señal sobre el servicio: hay que probarlo desde
fuera.

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

## 6. Qué hay en GitHub: poco, pero lo que hay es justo lo que hacía falta

> **También corregido.** La primera versión decía «prácticamente nada
> reutilizable». Es falso: existe una librería específica de Servientrega
> **Panamá**, y es la mejor fuente técnica de todo este documento.

| Lo que hay                                                                                                                | Qué es                                                  | ¿Sirve?                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| [`saulmoralespa/servientrega-webservice-panama-php`](https://github.com/saulmoralespa/servientrega-webservice-panama-php) | Librería PHP **de Panamá**. MIT, PHP 8.1, enero de 2025 | **Sí, y mucho.** Es el contrato completo: endpoints, sandbox, autenticación y todos los campos de la guía. 164 líneas, se lee en diez minutos |
| [`saulmoralespa/shipping-servientrega-wc`](https://github.com/saulmoralespa/shipping-servientrega-wc)                     | Plugin de WooCommerce, SOAP contra el `:8081`           | Solo como referencia, y **de Colombia**: su README lo dice                                                                                    |
| App de Servientrega para Shopify                                                                                          | Cotización y etiquetas                                  | Solo dentro de Shopify                                                                                                                        |
| App de Shippea para Shopify                                                                                               | Uno Express                                             | Solo dentro de Shopify                                                                                                                        |
| Clientes Node/TypeScript de couriers panameños                                                                            | —                                                       | **No existen**                                                                                                                                |

**Lo que esto significa para el plan:** sigue sin haber una dependencia que
instalar —es PHP, no TypeScript, y no corre en un Worker— pero **ya no hay que
adivinar el contrato**. La librería de Panamá documenta, leyendo su código y sus
tests, exactamente qué enviar y qué se recibe. Eso convierte la Fase L5 de
«no estimable sin credenciales» a «estimable hoy»: la parte de descubrimiento ya
está hecha, y queda portar unas 200 líneas a TypeScript.

Y el diseño de la Fase L5 aguanta sin un cambio: la interfaz de cuatro
operaciones —cotizar, crear guía, rastrear, recibir webhook— encaja exactamente
con lo que expone Servientrega Panamá.

---

## 7. Recomendación

**Orden de integración, por relación esfuerzo/resultado:**

1. **Dropi PA primero.** Un adaptador, cuatro couriers panameños y el pago contra
   entrega que la clienta necesita. Es el único que resuelve el caso central del
   negocio de una sola vez.
2. **DHL Express después**, si vende fuera de Panamá. Documentación pública,
   autoservicio, la más rápida de las cinco.
3. **Servientrega Panamá sube de puesto.** Antes la ponía la última por opaca;
   con la librería de referencia delante es la mejor documentada después de DHL.
   Hay sandbox, hay contrato conocido y hay contra entrega nativo. Sigue
   necesitando cuenta corporativa, pero el trabajo técnico ya se puede estimar:
   portar unas 200 líneas de PHP a TypeScript, con el SOAP construido a mano.
4. **Shippea, solo si la conversación comercial va bien.** Es la única que sigue
   sin API conocida. Mientras tanto, el campo de guía manual de la Fase L2 cubre
   el caso «lo mandamos por ellos y pegamos el número» sin integración ninguna.
5. **Los agregadores americanos, descartados** para el reparto local.

**Lo que hay que preguntar, y a quién:**

| A quién               | Qué                                                                                                             |
| --------------------- | --------------------------------------------------------------------------------------------------------------- |
| Dropi PA              | ¿La API aplica a Panamá? ¿Qué sustituye a `cod_dane`? ¿Hay webhooks? ¿Cómo y cuándo liquidan el contra entrega? |
| Shippea / Uno Express | ¿Existe API para integradores fuera de Shopify?                                                                 |
| Servientrega Panamá   | Solo credenciales de sandbox y producción. Lo técnico ya está resuelto: endpoints, campos y pruebas se conocen  |
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
- **[`saulmoralespa/servientrega-webservice-panama-php`](https://github.com/saulmoralespa/servientrega-webservice-panama-php)** — la fuente técnica principal de este documento
- [`saulmoralespa/shipping-servientrega-wc`](https://github.com/saulmoralespa/shipping-servientrega-wc) (Colombia)
- [Integración con Servientrega (Simla)](https://docs.simla.com/es/Users/Integration/DeliveryServices/ServiEntrega/IntegracionConServientrega)
- [Shippea](https://www.shippea.io/) · [Uno Express Panamá](https://unoexpresspanama.com/)
- [MyDHL API](https://developer.dhl.com/api-reference/dhl-express-mydhl-api) · [Catálogo de APIs de DHL](https://developer.dhl.com/api-catalog)
- [Carriers de Shippo](https://goshippo.com/carriers) · [Carriers de EasyPost](https://www.easypost.com/carriers/)
- [Banderas de compatibilidad de Cloudflare Workers](https://developers.cloudflare.com/workers/configuration/compatibility-flags/) (`allow_custom_ports`)
