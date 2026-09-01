import { codigoDeSesion, fechaEnPanama } from './codigo';
import { esExito, explicarCodigo, YAPPY_SIN_DATOS } from './codigos';
import type {
  FiltroYappy,
  HistorialYappy,
  MetodosCobroYappy,
  RespuestaYappy,
  SesionYappy,
  TransaccionYappy,
} from './tipos';

/**
 * Cliente de la API de integración de Yappy Comercial (la «Apificación»).
 *
 * QUÉ ES Y QUÉ NO ES
 *
 * Esta API **no cobra**. Abre una sesión, lista los movimientos del comercio y
 * lista sus métodos de cobro. Sirve para saber qué ha entrado, no para hacer que
 * entre. Cobrar en el checkout es el Botón de Pago, que es otro producto y otro
 * adaptador (`payments/providers/yappy.ts`).
 *
 * Confundirlos cuesta un día: los dos se llaman Yappy, los dos tienen una
 * «clave secreta», y las credenciales de uno devuelven un error genérico en el
 * otro.
 *
 * CÓMO SE USA
 *
 *   const cliente = clienteYappy(configuracionDeEntorno());
 *   await cliente.abrirSesion();
 *   const movimientos = await cliente.historial({ desde, hasta });
 *   await cliente.cerrarSesion();
 *
 * La sesión no se guarda en ningún sitio: se abre para el trabajo que se va a
 * hacer y se cierra al terminar. Cachearla entre peticiones obligaría a un
 * almacén compartido entre instancias del Worker, y el ahorro —una llamada por
 * conciliación— no lo justifica.
 */

/**
 * Los nombres de las dos cabeceras de credenciales.
 *
 * La especificación las declara como esquemas `Api-Key` y `Secret-Key`, pero en
 * el campo `name` pone «API Key» y «API secret Key», con espacios, que no son
 * nombres de cabecera válidos. Se usan los identificadores del esquema, que sí
 * lo son.
 *
 * **Si el login responde `YP-0008` (faltan cabeceras obligatorias), esto es lo
 * primero que hay que cambiar**, y hay que preguntárselo a
 * `integracionesdev@yappy.com.pa`. Está aquí arriba, con nombre propio, para
 * que ese cambio sea de una línea y no una cacería.
 */
const CABECERA_API_KEY = 'Api-Key';
const CABECERA_SECRET_KEY = 'Secret-Key';

/** Yappy no publica su tiempo de respuesta. Diez segundos es de sobra. */
const ESPERA_MAXIMA_MS = 10_000;

export interface ConfiguracionYappy {
  /**
   * Host de la API, sin barra final.
   *
   * No sale de la documentación: la especificación trae `http://localhost:3000`
   * como marcador de posición («path relativo global»), así que el host real lo
   * da Yappy al habilitar el comercio. Por eso es configuración y no una
   * constante.
   */
  apiUrl: string;
  apiKey: string;
  secretKey: string;
}

/** Fallo al hablar con Yappy, con el código que hay que citarles. */
export class YappyError extends Error {
  readonly codigo: string;

  constructor(codigo: string, mensaje: string) {
    super(mensaje);
    this.name = 'YappyError';
    this.codigo = codigo;
  }
}

/**
 * Las credenciales del entorno, o `null` si falta alguna.
 *
 * `null` y no una excepción: que Yappy no esté configurado es el estado normal
 * de una tienda que todavía no lo usa, y la pantalla de integraciones necesita
 * poder preguntarlo sin envolver la llamada en un `try`.
 */
export function configuracionDeEntorno(): ConfiguracionYappy | null {
  const apiUrl = process.env.YAPPY_API_URL?.trim();
  const apiKey = process.env.YAPPY_API_KEY?.trim();
  const secretKey = process.env.YAPPY_API_SECRET_KEY?.trim();

  // Se comprueba que no estén vacías, no que estén definidas: una variable sin
  // valor en GitHub Actions llega como cadena vacía, pasa cualquier `??` y
  // revienta más adelante con un error que no la menciona. Es la lección que ya
  // costó una compilación entera (ver docs/ESTADO.md § 4).
  if (!apiUrl || !apiKey || !secretKey) return null;

  return { apiUrl: apiUrl.replace(/\/+$/, ''), apiKey, secretKey };
}

/** ¿Hay credenciales de la API de Yappy Comercial en este entorno? */
export function estaConfigurado(): boolean {
  return configuracionDeEntorno() !== null;
}

export interface ConsultaHistorial {
  /** `YYYY-MM-DD`. */
  desde: string;
  /** `YYYY-MM-DD`. */
  hasta: string;
  limite?: number;
  filtros?: FiltroYappy[];
  /** Cursor de la página anterior (`pagination.token`). */
  cursor?: string;
}

export interface PaginaDeHistorial {
  transacciones: TransaccionYappy[];
  /** Cursor para pedir la siguiente página, o `null` si no hay más. */
  siguiente: string | null;
}

export function clienteYappy(config: ConfiguracionYappy) {
  let sesion: string | null = null;

  async function llamar<T>(
    ruta: string,
    opciones: { metodo: 'GET' | 'POST'; cuerpo?: unknown; conSesion?: boolean },
  ): Promise<T | null> {
    const cabeceras: Record<string, string> = {
      Accept: 'application/json',
      [CABECERA_API_KEY]: config.apiKey,
      [CABECERA_SECRET_KEY]: config.secretKey,
    };

    if (opciones.cuerpo !== undefined) cabeceras['Content-Type'] = 'application/json';

    if (opciones.conSesion) {
      if (!sesion) {
        throw new YappyError(
          'sin_sesion',
          'Hay que abrir la sesión con `abrirSesion()` antes de consultar nada.',
        );
      }
      cabeceras.Authorization = `Bearer ${sesion}`;
    }

    let respuesta: Response;
    try {
      respuesta = await fetch(`${config.apiUrl}${ruta}`, {
        method: opciones.metodo,
        headers: cabeceras,
        body: opciones.cuerpo === undefined ? undefined : JSON.stringify(opciones.cuerpo),
        signal: AbortSignal.timeout(ESPERA_MAXIMA_MS),
      });
    } catch (error) {
      // Un host mal puesto y un Yappy caído se distinguen aquí y no más
      // adelante: el mensaje nombra la URL para que se vea el error de dedo.
      throw new YappyError(
        'sin_respuesta',
        `No se pudo contactar con Yappy en ${config.apiUrl}${ruta}: ` +
          `${error instanceof Error ? error.message : 'error desconocido'}. ` +
          'Revisa YAPPY_API_URL.',
      );
    }

    // Un 401/403 no trae el sobre `{ status }`, así que se atrapa antes de
    // intentar leerlo como si lo trajera.
    if (respuesta.status === 401 || respuesta.status === 403) {
      throw new YappyError(
        'no_autorizado',
        `Yappy rechazó las credenciales (HTTP ${respuesta.status}). ` +
          'Genera credenciales nuevas en el portal o valida las actuales desde Integraciones.',
      );
    }

    const datos = (await respuesta.json().catch(() => null)) as RespuestaYappy<T> | null;

    if (!datos?.status) {
      throw new YappyError(
        'respuesta_ilegible',
        `Yappy respondió HTTP ${respuesta.status} con un cuerpo que no es el sobre esperado.`,
      );
    }

    if (!esExito(datos.status.code)) {
      throw new YappyError(
        datos.status.code,
        explicarCodigo(datos.status.code, datos.status.description),
      );
    }

    // `YP-0001` es «todo bien, no hay datos»: se distingue de un fallo
    // devolviendo `null` en vez de lanzar. Quien llama decide si eso es un
    // problema; casi nunca lo es.
    if (datos.status.code === YAPPY_SIN_DATOS) return null;

    return datos.body ?? null;
  }

  return {
    /**
     * Abre la sesión y guarda su token.
     *
     * `fecha` solo se pasa en los tests. En producción la calcula
     * `codigoDeSesion` con el huso de Panamá, que es lo que evita que la sesión
     * deje de abrirse cada tarde cuando el día UTC se adelanta.
     */
    async abrirSesion(fecha: string = fechaEnPanama()): Promise<void> {
      const code = await codigoDeSesion(config.apiKey, config.secretKey, fecha);

      const cuerpo = await llamar<SesionYappy>('/v1/session/login', {
        metodo: 'POST',
        cuerpo: { body: { code } },
      });

      const token = cuerpo?.token?.token;

      if (!token) {
        throw new YappyError(
          'sesion_sin_token',
          'Yappy dio la sesión por abierta pero no devolvió el token.',
        );
      }

      sesion = token;
    },

    /**
     * Cierra la sesión. No lanza.
     *
     * Va siempre en un `finally`, y ahí una excepción taparía la de verdad: si
     * el historial falló, lo que hay que ver es el fallo del historial, no que
     * además no se pudo cerrar la sesión.
     */
    async cerrarSesion(): Promise<void> {
      if (!sesion) return;
      try {
        await llamar<unknown>('/v1/session/logout', { metodo: 'GET', conSesion: true });
      } catch (error) {
        console.warn('[yappy] No se pudo cerrar la sesión:', error);
      } finally {
        sesion = null;
      }
    },

    /** Una página de movimientos. Sin transacciones si no hay ninguna. */
    async historial(consulta: ConsultaHistorial): Promise<PaginaDeHistorial> {
      const cuerpo = await llamar<HistorialYappy>('/v1/movement/history', {
        metodo: 'POST',
        conSesion: true,
        cuerpo: {
          body: {
            pagination: {
              start_date: consulta.desde,
              end_date: consulta.hasta,
              limit: consulta.limite ?? 50,
              ...(consulta.cursor ? { has_next_page: true, token: consulta.cursor } : {}),
            },
            ...(consulta.filtros?.length ? { filter: consulta.filtros } : {}),
          },
        },
      });

      return {
        transacciones: cuerpo?.transactions ?? [],
        // Solo se ofrece cursor cuando Yappy dice que hay más página Y manda
        // token. Con uno solo de los dos, seguir paginando es un bucle.
        siguiente:
          cuerpo?.pagination?.has_next_page && cuerpo.pagination.token
            ? cuerpo.pagination.token
            : null,
      };
    },

    /** Todas las páginas del rango, ya juntas. */
    async historialCompleto(
      consulta: ConsultaHistorial,
      maxPaginas = 20,
    ): Promise<TransaccionYappy[]> {
      const todas: TransaccionYappy[] = [];
      let cursor = consulta.cursor;

      // El tope de páginas es un cortacircuitos, no una regla de negocio: si
      // Yappy devolviera siempre `has_next_page`, sin él esto no terminaría
      // nunca y se llevaría por delante el tiempo de CPU del Worker.
      for (let pagina = 0; pagina < maxPaginas; pagina += 1) {
        const { transacciones, siguiente } = await this.historial({ ...consulta, cursor });
        todas.push(...transacciones);
        if (!siguiente) return todas;
        cursor = siguiente;
      }

      console.warn(`[yappy] Se alcanzó el tope de ${maxPaginas} páginas; puede faltar historial.`);
      return todas;
    },

    async detalle(transaccionId: string): Promise<TransaccionYappy | null> {
      return llamar<TransaccionYappy>(`/v1/movement/${encodeURIComponent(transaccionId)}`, {
        metodo: 'GET',
        conSesion: true,
      });
    },

    /** Los métodos de cobro del comercio: alias del botón, del punto, del POS… */
    async metodosDeCobro(): Promise<MetodosCobroYappy | null> {
      return llamar<MetodosCobroYappy>('/v1/collection-method', {
        metodo: 'GET',
        conSesion: true,
      });
    },
  };
}

export type ClienteYappy = ReturnType<typeof clienteYappy>;
