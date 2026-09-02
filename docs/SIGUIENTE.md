# El plan, para quien siga

> **Para quién es esto:** la persona que reciba este repositorio con acceso a
> Supabase y a Cloudflare, y quiera saber en veinte minutos qué hay hecho, qué
> puede tocar hoy y qué está esperando a otra cosa.
>
> Los dos documentos que lo acompañan: [`ESTADO.md`](ESTADO.md) dice **qué hay y
> qué se aprendió por las malas**; [`CONECTAR.md`](CONECTAR.md) dice **cómo
> enchufarlo**, paso a paso. Este dice **por dónde seguir**.

---

## Lo primero, y son veinte minutos

En este orden, porque cada uno hace visible lo siguiente:

1. **Publica lo que hay.** Actions → «Publicar en staging» → Run workflow. Todo
   lo construido en septiembre está mergeado y sin publicar.
2. **Abre la bóveda de credenciales** ([#33](https://github.com/juanarrietabusiness-pixel/tommalopty/issues/33)):
   una variable y una migración, en [`CONECTAR.md` § 9](CONECTAR.md). Es lo que
   permite que la dueña ponga sus propias claves sin llamar a nadie.
3. **Mira el diff de los tipos** en el resumen del job de CI, y ciérra el
   [#5](https://github.com/juanarrietabusiness-pixel/tommalopty/issues/5). Ya se
   sabe que no es deriva de esquema: es formato. Falta regenerar con Docker.

Con eso, lo construido deja de estar esperando.

---

## Cómo está repartido el trabajo que queda

La pregunta que ahorra tiempo no es «¿qué falta?» sino **«¿qué lo está
bloqueando?»**, porque la respuesta cambia a quién hay que ir a buscar.

| Lo bloquea…                 | Qué queda ahí                                                                                                                                                                                                                                             | Qué hacer                                                               |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| **Nada. Es programar**      | Los avisos de correo que faltan (en camino, entregado, recordatorio de saldo), el envío de la posición del motorizado desde el teléfono ([#29](https://github.com/juanarrietabusiness-pixel/tommalopty/issues/29)), `/cuenta/direcciones` de solo lectura | Se puede hacer hoy, sin accesos                                         |
| **Un acceso que tú tienes** | La bóveda ([#33](https://github.com/juanarrietabusiness-pixel/tommalopty/issues/33)), los tipos ([#5](https://github.com/juanarrietabusiness-pixel/tommalopty/issues/5)), la prueba del bucket privado, backups, Cloudflare Access                        | [`CONECTAR.md`](CONECTAR.md)                                            |
| **Comprar algo**            | El dominio (bloquea Resend, R2 y las pasarelas), el plan de teselas del mapa (bloquea también el mapa de despacho, [#30](https://github.com/juanarrietabusiness-pixel/tommalopty/issues/30))                                                              | Es de la dueña. Pídelo cuanto antes                                     |
| **Una decisión de negocio** | Las liquidaciones de motorizados ([#28](https://github.com/juanarrietabusiness-pixel/tommalopty/issues/28))                                                                                                                                               | Una pregunta a la dueña, con las cuatro respuestas posibles ya escritas |
| **Un tercero**              | El Botón de Pago de Yappy y el host de su API, las credenciales de Dropi/Servientrega, la revisión legal                                                                                                                                                  | Correos escritos en [`ESTADO.md`](ESTADO.md) § 5                        |

**Casi nada de lo que queda es programar.** Conviene saberlo antes de planificar
una semana de desarrollo: lo que bloquea la apertura son un dominio, unas páginas
legales y dos respuestas de Yappy.

---

## Lo que se construyó en septiembre, y dónde mirarlo

| Qué                               | Dónde                                      | Necesita                                |
| --------------------------------- | ------------------------------------------ | --------------------------------------- |
| Pantalla de **Despacho**          | Panel `/despacho`                          | Nada. Publicar                          |
| **Motorizados** con su app        | Panel `/motorizados`, tienda `/motorizado` | Nada. Publicar                          |
| **Bóveda de credenciales**        | Panel `/configuracion`                     | Una variable y una migración            |
| **Importar productos**            | Panel `/catalogo/importar`                 | Nada. Publicar                          |
| **Eventos de Meta** completos     | Toda la tienda                             | El píxel, que ya se pega en el panel    |
| **Mapa que rellena la dirección** | Tienda `/checkout`                         | Nada. Un plan de teselas antes de abrir |

---

## Cinco cosas que este repositorio aprendió por las malas

Están en [`ESTADO.md` § 4](ESTADO.md) con el detalle. Se resumen aquí porque las
cinco cuestan medio día si se descubren de nuevo:

1. **`NEXT_PUBLIC_*` hay que escribirlo literal.** Una lectura por nombre
   —`env[clave]`— no la sustituye Next, y en el Worker esa variable no existe.
2. **`anon` nace con todos los privilegios** sobre cada tabla nueva, porque el
   arranque de Supabase declara los suyos. Se revoca en la propia migración,
   tabla por tabla y **nunca con un bucle**.
3. **`authenticated` no es sinónimo de cliente.** Quien administra también lo es.
4. **Un test que no puede fallar no prueba nada.** Comprobar siempre que falla sin
   el arreglo — y si el test corre contra la aplicación construida, **reconstruir
   entre medias**, o se prueba el paquete viejo y todo parece bien.
5. **Un elemento de rejilla no encoge por debajo de su contenido.** `1fr` es
   `minmax(auto, 1fr)`, y ese `auto` estira la página entera. Es lo que hacía que
   el panel no se pudiera usar en un teléfono.

---

## Cómo trabajar esto con Claude Code

Si vas a seguir con una sesión de Claude Code, lo que más tiempo ahorra es
señalarle los documentos en vez de explicarle el proyecto:

> Lee `docs/SIGUIENTE.md`, `docs/ESTADO.md` y `docs/CONECTAR.md` antes de tocar
> nada. Tengo los conectores de Supabase y Cloudflare puestos sobre el proyecto
> real.

`CONECTAR.md` lleva qué herramienta MCP corresponde a cada paso y las tres cosas
que hay que decirle explícitamente porque no puede adivinarlas.

**Y la regla que el dueño del proyecto pidió que quedara escrita:** ninguna
sesión usa los conectores personales de quien programa para esta plataforma. Son
cuentas de una persona y el negocio es de otra. Lo que haga falta conectar se
escribe en un issue y lo ejecuta quien tenga las credenciales del negocio.

---

## Cómo se verifica aquí

Antes de dar nada por bueno, esto es lo que corre:

```bash
pnpm lint && pnpm typecheck    # 7 paquetes en TypeScript estricto
pnpm test                      # dominio, integraciones, y RLS contra Postgres real
pnpm test:e2e                  # 310 tests en escritorio, tablet y móvil
```

Los end-to-end incluyen una **auditoría de accesibilidad WCAG 2.1 AA** en cada
PR, y desde la auditoría de interfaz también comprueban que ninguna pantalla se
desborde a lo ancho y que ningún campo baje de 16px en un dispositivo táctil.

En un entorno sin los navegadores de Playwright instalados:
`PLAYWRIGHT_CHROMIUM_PATH=/ruta/a/chromium pnpm test:e2e`.
