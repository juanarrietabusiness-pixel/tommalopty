# 0002 · Cloudflare para hosting, CDN y almacenamiento

**Estado:** aceptada · agosto 2026

## Contexto

La plataforma debe soportar crecimiento de tienda local a operación
transnacional. La decisión de hosting condiciona el costo a escala, la latencia
global y qué se puede ejecutar en el servidor.

Las opciones evaluadas fueron Netlify, Cloudflare, y una combinación de ambos.
Supabase queda fijo como base de datos y autenticación en los tres casos, por ser
agnóstico del hosting.

## Decisión

**Cloudflare para todo lo que no sea base de datos**: Workers para ambas
aplicaciones, R2 para las imágenes del catálogo, y DNS/CDN/WAF del mismo
proveedor. Supabase para datos y autenticación.

Dos proveedores en total.

## Por qué

**El ancho de banda es el costo que crece con el éxito.** Cloudflare Workers no
cobra transferencia, y R2 tiene egress cero. Netlify cobra ~$0,13/GB por encima
de los 150 GB del plan Pro. La diferencia absoluta no es enorme, pero la forma de
la curva sí: una campaña que multiplica el tráfico por diez no mueve la factura
de Cloudflare. Los números concretos están en [`../COSTOS.md`](../COSTOS.md).

**Un proveedor menos es una superficie de fallo menos.** CDN, WAF, protección
anti-bots, rate limiting y Access —para blindar el panel administrativo— vienen
del mismo sitio, con una sola configuración y una sola factura.

**El e-commerce es carga de E/S, no de CPU.** El límite de tiempo de CPU por
petición de Workers no estorba a un flujo que consiste en leer base de datos,
renderizar HTML y llamar APIs.

## Lo que se acepta a cambio

**El runtime no es Node.js**, sino V8 aislado con capa de compatibilidad. Ya se
notó durante el desarrollo:

- El nuevo `proxy.ts` de Next 16 solo corre en Node y el adaptador de Cloudflare
  aún no lo soporta. Las apps se quedan en `middleware.ts` —obsoleto pero
  funcional— hasta que eso cambie.
- Paquetes npm que dependan de APIs nativas de Node pueden necesitar sustituto.
- Las tareas largas (importaciones masivas, informes pesados) van a colas o
  tareas programadas, no dentro de una petición.

## Cómo se mantiene reversible

**Regla de arquitectura: el código de aplicación no importa APIs específicas de
Cloudflare.** El adaptador actúa solo en tiempo de build; los bindings, si
llegan a usarse, se acceden tras una interfaz propia.

Cambiar de proveedor implicaría sustituir el paso de build y el archivo de
despliegue. No reescribir la aplicación. Esta regla se revisa en cada PR que
toque infraestructura.

## Cuándo reconsiderar esta decisión

- Si algún paquete imprescindible resulta imposible de ejecutar en Workers.
- Si el límite de CPU por petición bloquea una funcionalidad de negocio real.
- Si Netlify o Vercel eliminan el cobro por ancho de banda.
- Si el equipo pierde más tiempo peleando con el runtime del que ahorra en
  factura.
