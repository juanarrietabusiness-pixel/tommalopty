# Decisiones de arquitectura (ADR)

Un ADR registra **una decisión y por qué se tomó**, para que dentro de un año
nadie la revierta sin conocer el motivo — ni la mantenga por inercia cuando el
motivo ya no aplica.

Se escribe uno cuando la decisión es cara de revertir: elección de proveedor,
modelo de seguridad, estructura de datos, contrato entre módulos.

| #                                             | Decisión                                        | Estado   |
| --------------------------------------------- | ----------------------------------------------- | -------- |
| [0001](0001-monorepo-dos-apps.md)             | Monorepo con dos aplicaciones separadas         | Aceptada |
| [0002](0002-hosting.md)                       | Cloudflare para hosting, CDN y almacenamiento   | Aceptada |
| [0003](0003-seguridad-en-la-base-de-datos.md) | La seguridad vive en RLS, no en la aplicación   | Aceptada |
| [0004](0004-pedidos-transaccionales.md)       | Los pedidos se crean en una función de Postgres | Aceptada |
| [0005](0005-cms-propio.md)                    | CMS y CRM propios, sin plataforma externa       | Aceptada |
| [0006](0006-pasarela-al-final.md)             | La pasarela de pago se conecta al final         | Aceptada |
| [0007](0007-media-en-cloudflare.md)           | El media vive en Cloudflare; Supabase, datos    | Aceptada |
