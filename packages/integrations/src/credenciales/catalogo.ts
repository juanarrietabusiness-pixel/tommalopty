/**
 * Qué credenciales pide cada integración, declarado en un solo sitio.
 *
 * Esto existe para que el panel **no** sea una lista de tarjetas que crece cada
 * vez que alguien añade un servicio. La pantalla no conoce ninguna integración:
 * lee esta tabla, la agrupa por propósito y dibuja los campos que cada una
 * declara. Añadir la siguiente pasarela es añadir una entrada aquí.
 *
 * También es la única fuente que sabe **qué es secreto y qué no**, y esa
 * distinción decide si un valor se cifra y no vuelve nunca al navegador o si se
 * puede enseñar tal cual.
 */

/** Por qué existe cada integración. Es como se agrupa el panel. */
export const GRUPOS = {
  pagos: 'Cobrar',
  marketing: 'Publicidad y medición',
  correo: 'Correo',
  mapas: 'Mapas',
  logistica: 'Transporte',
} as const;

export type Grupo = keyof typeof GRUPOS;

export interface CampoDeCredencial {
  /** Nombre de la variable, tal cual. Es también la clave con la que se guarda. */
  clave: string;
  etiqueta: string;
  /**
   * Un secreto se cifra al guardarlo y **nunca** vuelve al navegador: se enseña
   * enmascarado. Lo que no es secreto se puede leer y editar tal cual.
   */
  secreto: boolean;
  requerido: boolean;
  /**
   * `true` si el valor acaba en el navegador de cualquier visitante — un
   * identificador de píxel, la URL de las teselas. No son secretos y marcarlos
   * como tales sería teatro: viajan en el HTML de todas formas.
   */
  publico?: boolean;
  ayuda?: string;
  ejemplo?: string;
}

export interface Integracion {
  proveedor: string;
  nombre: string;
  grupo: Grupo;
  /** Una frase: qué hace, en términos de la tienda y no del proveedor. */
  resumen: string;
  campos: CampoDeCredencial[];
  /** Dónde consigue alguien estas credenciales. */
  donde?: string;
  /** Si distingue pruebas de producción. PayPal sí; el píxel de Meta no. */
  tieneEntornos: boolean;
  /**
   * Por qué no se puede activar todavía, si es el caso. Que salga escrito en la
   * propia tarjeta evita la pregunta «¿y esto por qué no funciona?».
   */
  bloqueadaPor?: string;
}

export const INTEGRACIONES: readonly Integracion[] = [
  {
    proveedor: 'yappy',
    nombre: 'Yappy · Botón de Pago',
    grupo: 'pagos',
    resumen: 'Cobrar con Yappy en el checkout, desde la aplicación del banco.',
    tieneEntornos: true,
    donde: 'Banco General entrega estas credenciales al afiliar el comercio.',
    bloqueadaPor:
      'Falta la especificación del Botón de Pago, pedida a botondepagoyappy@bgeneral.com. ' +
      'Las credenciales se pueden guardar ya; el cobro se activará cuando llegue.',
    campos: [
      {
        clave: 'YAPPY_MERCHANT_ID',
        etiqueta: 'Código de comercio',
        secreto: false,
        requerido: true,
        ayuda: 'También llamado «código semilla» en la documentación de Yappy.',
      },
      {
        clave: 'YAPPY_SECRET_KEY',
        etiqueta: 'Clave secreta',
        secreto: true,
        requerido: true,
      },
      {
        clave: 'YAPPY_DOMAIN_URL',
        etiqueta: 'Dominio del comercio',
        secreto: false,
        requerido: true,
        ayuda: 'Yappy rechaza las peticiones que no vengan del dominio registrado.',
        ejemplo: 'https://tutienda.com',
      },
    ],
  },
  {
    proveedor: 'yappy_core',
    nombre: 'Yappy · Integración Core',
    grupo: 'pagos',
    resumen: 'Consultar cobros recibidos para conciliarlos con los pedidos.',
    tieneEntornos: true,
    donde: 'Se piden a integracionesdev@yappy.com.pa.',
    bloqueadaPor:
      'Falta el host de la API: la especificación trae un marcador en vez de la dirección real.',
    campos: [
      {
        clave: 'YAPPY_API_URL',
        etiqueta: 'Dirección de la API',
        secreto: false,
        requerido: true,
        ayuda: 'Lo que falta por saber. Debería venir en el correo de afiliación.',
        ejemplo: 'https://api.yappy.com.pa',
      },
      { clave: 'YAPPY_API_KEY', etiqueta: 'API key', secreto: true, requerido: true },
      {
        clave: 'YAPPY_API_SECRET_KEY',
        etiqueta: 'Clave secreta de la API',
        secreto: true,
        requerido: true,
      },
    ],
  },
  {
    proveedor: 'paypal',
    nombre: 'PayPal',
    grupo: 'pagos',
    resumen: 'Cobrar con tarjeta o cuenta de PayPal.',
    tieneEntornos: true,
    donde: 'developer.paypal.com → Apps & Credentials.',
    campos: [
      { clave: 'PAYPAL_CLIENT_ID', etiqueta: 'Client ID', secreto: false, requerido: true },
      { clave: 'PAYPAL_CLIENT_SECRET', etiqueta: 'Client secret', secreto: true, requerido: true },
      {
        clave: 'PAYPAL_WEBHOOK_ID',
        etiqueta: 'Webhook ID',
        secreto: false,
        requerido: false,
        ayuda: 'Sin esto no se puede comprobar que un aviso de pago viene de PayPal de verdad.',
      },
    ],
  },
  {
    proveedor: 'wompi',
    nombre: 'Wompi',
    grupo: 'pagos',
    resumen: 'Cobrar con tarjeta, Nequi y PSE.',
    tieneEntornos: true,
    campos: [
      { clave: 'WOMPI_PUBLIC_KEY', etiqueta: 'Llave pública', secreto: false, requerido: true },
      { clave: 'WOMPI_PRIVATE_KEY', etiqueta: 'Llave privada', secreto: true, requerido: true },
      {
        clave: 'WOMPI_EVENTS_SECRET',
        etiqueta: 'Secreto de eventos',
        secreto: true,
        requerido: false,
        ayuda: 'Firma los avisos de pago. Sin él no se puede distinguir uno falso.',
      },
    ],
  },
  {
    proveedor: 'paguelofacil',
    nombre: 'PagueloFácil',
    grupo: 'pagos',
    resumen: 'Cobrar con tarjeta, muy usado en Panamá.',
    tieneEntornos: true,
    campos: [
      { clave: 'PAGUELOFACIL_CCLW', etiqueta: 'CCLW', secreto: true, requerido: true },
      {
        clave: 'PAGUELOFACIL_ACCESS_TOKEN',
        etiqueta: 'Access token',
        secreto: true,
        requerido: false,
      },
    ],
  },
  {
    proveedor: 'meta_pixel',
    nombre: 'Meta · Píxel y Conversions API',
    grupo: 'marketing',
    resumen: 'Medir qué anuncios venden, y que Meta pueda optimizar por compras reales.',
    tieneEntornos: false,
    donde: 'business.facebook.com → Administrador de eventos → tu píxel.',
    campos: [
      {
        clave: 'NEXT_PUBLIC_META_PIXEL_ID',
        etiqueta: 'ID del píxel',
        secreto: false,
        requerido: true,
        publico: true,
        ayuda: 'Son 15 o 16 dígitos. Viaja en el navegador de cada visitante: no es un secreto.',
        ejemplo: '1234567890123456',
      },
      {
        clave: 'META_CONVERSIONS_ACCESS_TOKEN',
        etiqueta: 'Token de la Conversions API',
        secreto: true,
        requerido: false,
        ayuda:
          'Sin esto el píxel sigue midiendo, pero pierde las compras de quien use bloqueador de anuncios.',
      },
      {
        clave: 'META_TEST_EVENT_CODE',
        etiqueta: 'Código de evento de prueba',
        secreto: false,
        requerido: false,
        ayuda: 'Temporal. Sirve para verlos llegar en la pestaña «Probar eventos» de Meta.',
      },
    ],
  },
  {
    proveedor: 'ga4',
    nombre: 'Google Analytics 4',
    grupo: 'marketing',
    resumen: 'Estadísticas de visitas y comportamiento.',
    tieneEntornos: false,
    campos: [
      {
        clave: 'NEXT_PUBLIC_GA4_MEASUREMENT_ID',
        etiqueta: 'ID de medición',
        secreto: false,
        requerido: true,
        publico: true,
        ejemplo: 'G-XXXXXXXXXX',
      },
    ],
  },
  {
    proveedor: 'resend',
    nombre: 'Resend',
    grupo: 'correo',
    resumen: 'Los avisos automáticos: pedido recibido, pago confirmado, pedido enviado.',
    tieneEntornos: false,
    donde: 'resend.com → API Keys. El dominio hay que verificarlo antes.',
    bloqueadaPor: 'Necesita un dominio propio verificado en Resend.',
    campos: [
      { clave: 'RESEND_API_KEY', etiqueta: 'API key', secreto: true, requerido: true },
      {
        clave: 'EMAIL_FROM',
        etiqueta: 'Remitente',
        secreto: false,
        requerido: true,
        ayuda: 'El dominio tiene que estar verificado en Resend o los correos no salen.',
        ejemplo: 'Tienda <hola@tutienda.com>',
      },
      {
        clave: 'EMAIL_REPLY_TO',
        etiqueta: 'Responder a',
        secreto: false,
        requerido: false,
        ayuda: 'A dónde llega la respuesta cuando un cliente contesta al aviso.',
      },
    ],
  },
  {
    proveedor: 'mapa',
    nombre: 'Teselas del mapa',
    grupo: 'mapas',
    resumen: 'Las imágenes del mapa del checkout y de la pantalla de despacho.',
    tieneEntornos: false,
    bloqueadaPor:
      'Hoy se usa CARTO sin clave. Su cuota razonable no cubre una tienda abierta al público.',
    campos: [
      {
        clave: 'NEXT_PUBLIC_MAP_TILES_URL',
        etiqueta: 'URL de las teselas',
        secreto: false,
        requerido: true,
        publico: true,
        ayuda: 'Plantilla con {z}/{x}/{y}. Si el proveedor pide clave, va dentro de la URL.',
        ejemplo: 'https://tiles.ejemplo.com/{z}/{x}/{y}.png?key=…',
      },
    ],
  },
];

export function integracionPorProveedor(proveedor: string): Integracion | undefined {
  return INTEGRACIONES.find((i) => i.proveedor === proveedor);
}

/** Todas las claves declaradas por alguna integración. */
export function clavesConocidas(): Set<string> {
  return new Set(INTEGRACIONES.flatMap((i) => i.campos.map((c) => c.clave)));
}

export interface EstadoDeIntegracion {
  configurada: boolean;
  faltan: string[];
}

/**
 * ¿Está lista para usarse?
 *
 * Recibe **qué claves tienen valor**, no los valores: quien pinta el panel no
 * necesita ver un secreto para decir que está puesto, y no dárselo es la forma
 * de que no pueda filtrarlo.
 *
 * Solo cuentan los campos requeridos. Marcar como incompleta una integración a
 * la que solo le falta un campo opcional manda a alguien a buscar durante media
 * hora un dato que no necesita.
 */
export function estadoDeIntegracion(
  integracion: Integracion,
  clavesConValor: ReadonlySet<string>,
): EstadoDeIntegracion {
  const faltan = integracion.campos
    .filter((campo) => campo.requerido && !clavesConValor.has(campo.clave))
    .map((campo) => campo.clave);

  return { configurada: faltan.length === 0, faltan };
}

/** Las integraciones agrupadas por propósito, en el orden en que se declaran los grupos. */
export function porGrupo(): { grupo: Grupo; titulo: string; integraciones: Integracion[] }[] {
  return (Object.keys(GRUPOS) as Grupo[])
    .map((grupo) => ({
      grupo,
      titulo: GRUPOS[grupo],
      integraciones: INTEGRACIONES.filter((i) => i.grupo === grupo),
    }))
    .filter((seccion) => seccion.integraciones.length > 0);
}
