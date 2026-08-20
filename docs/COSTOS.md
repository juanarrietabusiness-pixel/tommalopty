# Modelo de costos

Precios verificados en agosto de 2026. **Confirmarlos antes de comprometer
presupuesto**: los proveedores los cambian, y algunos planes se renegocian a
volumen.

Todos los importes son en USD/mes.

---

## Supuestos

Un pedido medio de e-commerce genera aproximadamente:

- ~15 peticiones HTTP por visita (documento, JS, datos, imágenes)
- ~300 KB de HTML/JS por visita, más ~1,5 MB de imágenes
- ~2 emails transaccionales por pedido (confirmación + envío)
- Tasa de conversión del 2 % (conservadora para e-commerce)

## Escala 1 · Lanzamiento

5.000 visitas/mes · ~100 pedidos/mes · catálogo de 200 productos

| Servicio               | Plan                           | Costo   |
| ---------------------- | ------------------------------ | ------- |
| Cloudflare Workers     | Free (100k peticiones/día)     | $0      |
| Cloudflare R2          | 10 GB gratis, egress $0        | $0      |
| Cloudflare DNS/CDN/WAF | Free                           | $0      |
| Supabase               | Free (500 MB BD, 1 GB storage) | $0      |
| Resend                 | Free (3.000 emails/mes)        | $0      |
| Microsoft Clarity      | Gratis, sin límite de sesiones | $0      |
| Dominio                | —                              | ~$1     |
| **Total**              |                                | **~$1** |

El plan gratuito de Supabase pausa el proyecto tras una semana de inactividad.
En cuanto haya tráfico real, pasar a Pro ($25) por los backups: **una tienda sin
backups no está en producción.**

Presupuesto realista de arranque: **$25–30/mes.**

## Escala 2 · Crecimiento

50.000 visitas/mes · ~1.000 pedidos/mes · catálogo de 2.000 productos

| Servicio           | Cálculo                            | Costo       |
| ------------------ | ---------------------------------- | ----------- |
| Cloudflare Workers | 750k peticiones (de 10M incluidas) | $5          |
| Cloudflare R2      | 50 GB × $0,015 · egress $0         | ~$1         |
| Supabase Pro       | 8 GB BD, 250 GB egress incluidos   | $25         |
| Resend             | ~2.000 emails/mes                  | $0–20       |
| Clarity            |                                    | $0          |
| **Total**          |                                    | **~$31–51** |

A esta escala el costo es prácticamente ruido frente a la facturación. Con un
ticket medio de $35, 1.000 pedidos son $35.000/mes: la infraestructura cuesta el
**0,1 %** de las ventas.

## Escala 3 · Transnacional

1.000.000 visitas/mes · ~20.000 pedidos/mes · catálogo de 50.000 productos

| Servicio                        | Cálculo                                      | Costo           |
| ------------------------------- | -------------------------------------------- | --------------- |
| Cloudflare Workers · peticiones | 15M − 10M incluidas = 5M × $0,30/M           | $1,50 + $5 base |
| Cloudflare Workers · CPU        | ~150M CPU-ms − 30M incl. × $0,02/M           | ~$2,40          |
| Cloudflare R2                   | 300 GB × $0,015 · **egress $0**              | ~$5             |
| Supabase Pro + cómputo          | Instancia mayor para el volumen de consultas | ~$135           |
| Supabase egress                 | ~400 GB − 250 incl. × $0,09                  | ~$14            |
| Resend                          | ~40.000 emails/mes                           | ~$85            |
| Clarity                         |                                              | $0              |
| **Total**                       |                                              | **~$250**       |

Con 20.000 pedidos y ticket medio de $35 son $700.000/mes de facturación. La
infraestructura es el **0,04 %**. Para comparar, la comisión de la pasarela de
pago (~2,75 %) serían ~$19.000/mes: **el costo real de vender online son las
comisiones, no los servidores.**

---

## Por qué Cloudflare y no Netlify

Es la decisión que más impacta el costo a escala, así que conviene entender el
mecanismo, no solo el número.

**Cloudflare Workers no cobra ancho de banda.** Ni de entrada ni de salida.
Se paga por peticiones y por tiempo de CPU, y ambos son baratos.

**Netlify cobra por ancho de banda.** El plan Pro son $20/mes con ~150 GB
incluidos; a partir de ahí, ~$0,13/GB.

Con las imágenes servidas desde R2 (egress $0) la diferencia se modera, porque
lo que pasaría por Netlify sería solo HTML y JS:

| Escala         | Tráfico HTML/JS | Netlify                           | Cloudflare |
| -------------- | --------------- | --------------------------------- | ---------- |
| 50.000 visitas | ~15 GB          | $20 (incluido)                    | $5         |
| 1M visitas     | ~300 GB         | $20 + 150 GB × $0,13 = **~$40**   | **~$9**    |
| 5M visitas     | ~1,5 TB         | $20 + 1,35 TB × $0,13 = **~$196** | **~$30**   |

La diferencia absoluta no es dramática en dinero, pero la **forma de la curva**
sí: la de Cloudflare es casi plana, la de Netlify crece con cada visita. Cuando
una campaña multiplica el tráfico por diez, en Cloudflare la factura apenas se
mueve; en Netlify se multiplica.

A eso se suma que Cloudflare aporta CDN, WAF, protección anti-bots, rate
limiting y Access (para blindar el panel) sin proveedor adicional.

### Lo que se paga a cambio

**El runtime de Workers no es Node.js.** Es V8 aislado con una capa de
compatibilidad. En la práctica, en este proyecto ya se notó:

- El nuevo `proxy.ts` de Next 16 solo funciona en Node, así que las apps se
  quedan en `middleware.ts` (obsoleto pero funcional) hasta que el adaptador lo
  soporte.
- Algún paquete npm que dependa de APIs nativas de Node necesitará polyfill o
  sustituto. Los SDK modernos de pasarelas usan `fetch` y funcionan; los
  antiguos, no siempre.
- Hay un límite de CPU por petición. Las tareas largas (importaciones masivas,
  generación de informes pesados) hay que moverlas a colas o tareas
  programadas, no resolverlas dentro de una petición.

**Ninguno de esos límites es un obstáculo para un e-commerce**, que es
mayoritariamente E/S: leer base de datos, renderizar HTML, llamar a APIs. Pero
son reales y conviene conocerlos antes de elegir.

### Cómo se mantiene reversible

El código **no importa ni una sola API específica de Cloudflare**. El adaptador
actúa solo en tiempo de build. Cambiar de proveedor sería sustituir el paso de
build y el archivo de configuración de despliegue, no reescribir la aplicación.
Eso se mantiene así a propósito: ver [`adr/0002-hosting.md`](adr/0002-hosting.md).

---

## Costos que no son de infraestructura

Lo que de verdad pesa en el presupuesto:

| Concepto                                 | Escala 2 | Escala 3 |
| ---------------------------------------- | -------- | -------- |
| Comisiones de pasarela (~2,75 % + $0,25) | ~$1.000  | ~$19.000 |
| Publicidad (Meta/Google, si se invierte) | variable | variable |
| Desarrollo y mantenimiento               | variable | variable |
| Infraestructura                          | ~$40     | ~$250    |

**Negociar la comisión de la pasarela ahorra más que cualquier optimización de
infraestructura.** A partir de cierto volumen, las pasarelas negocian: bajar del
2,75 % al 2,4 % a escala 3 son ~$2.400/mes, diez veces la factura de servidores.
