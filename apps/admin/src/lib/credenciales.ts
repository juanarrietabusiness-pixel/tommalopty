import { cache } from 'react';
import { credenciales as cred, type credenciales } from '@nebula/integrations';
import { listCredenciales, type CredencialCifrada } from '@nebula/db';
import { esModoDemostracion } from './demo-mode';

/**
 * Lo que el panel necesita saber de las credenciales, y **solo** eso.
 *
 * Nunca se descifra nada para pintar esta pantalla: se leen las pistas, que ya
 * vienen guardadas. Una pantalla que no descifra es una pantalla que no puede
 * filtrar un secreto por un `console.log` olvidado o por un mensaje de error.
 */

export interface CampoConEstado {
  campo: credenciales.CampoDeCredencial;
  /** `••••4821`, o el valor entero si no es secreto. `null` si no hay nada puesto. */
  pista: string | null;
  /** De dónde sale hoy: importa para saber si editarla aquí va a servir de algo. */
  origen: 'boveda' | 'entorno' | null;
}

export interface IntegracionConEstado {
  integracion: credenciales.Integracion;
  campos: CampoConEstado[];
  configurada: boolean;
  faltan: string[];
}

export interface SeccionDeIntegraciones {
  grupo: credenciales.Grupo;
  titulo: string;
  integraciones: IntegracionConEstado[];
}

export interface EstadoDeLaBoveda {
  secciones: SeccionDeIntegraciones[];
  /** Sin clave maestra la bóveda no puede cifrar, y hay que decirlo arriba del todo. */
  hayClaveMaestra: boolean;
  /** Falso mientras la migración no esté aplicada. */
  bovedaDisponible: boolean;
}

/**
 * Qué variables de entorno hay puestas.
 *
 * **Escritas literales y no leídas por nombre**, que es la única forma que
 * funciona: Next sustituye `process.env.NEXT_PUBLIC_ALGO` en compilación cuando
 * está escrito así, y una lectura dinámica —`entorno[clave]`— no la reconoce.
 *
 * Esto era exactamente el fallo que hacía que la pantalla dijese «sin
 * credenciales» aunque el píxel estuviera configurado: el mapa se recorría con
 * `process.env[clave]`, y para las `NEXT_PUBLIC_*` eso siempre daba `undefined`.
 */
function entornoDeCredenciales(): Record<string, string | undefined> {
  return {
    PAYPAL_CLIENT_ID: process.env.PAYPAL_CLIENT_ID,
    PAYPAL_CLIENT_SECRET: process.env.PAYPAL_CLIENT_SECRET,
    PAYPAL_WEBHOOK_ID: process.env.PAYPAL_WEBHOOK_ID,
    WOMPI_PUBLIC_KEY: process.env.WOMPI_PUBLIC_KEY,
    WOMPI_PRIVATE_KEY: process.env.WOMPI_PRIVATE_KEY,
    WOMPI_EVENTS_SECRET: process.env.WOMPI_EVENTS_SECRET,
    PAGUELOFACIL_CCLW: process.env.PAGUELOFACIL_CCLW,
    PAGUELOFACIL_ACCESS_TOKEN: process.env.PAGUELOFACIL_ACCESS_TOKEN,
    YAPPY_MERCHANT_ID: process.env.YAPPY_MERCHANT_ID,
    YAPPY_SECRET_KEY: process.env.YAPPY_SECRET_KEY,
    YAPPY_DOMAIN_URL: process.env.YAPPY_DOMAIN_URL,
    YAPPY_API_URL: process.env.YAPPY_API_URL,
    YAPPY_API_KEY: process.env.YAPPY_API_KEY,
    YAPPY_API_SECRET_KEY: process.env.YAPPY_API_SECRET_KEY,
    META_CONVERSIONS_ACCESS_TOKEN: process.env.META_CONVERSIONS_ACCESS_TOKEN,
    META_TEST_EVENT_CODE: process.env.META_TEST_EVENT_CODE,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
    EMAIL_REPLY_TO: process.env.EMAIL_REPLY_TO,
    NEXT_PUBLIC_META_PIXEL_ID: process.env.NEXT_PUBLIC_META_PIXEL_ID,
    NEXT_PUBLIC_GA4_MEASUREMENT_ID: process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID,
    NEXT_PUBLIC_MAP_TILES_URL: process.env.NEXT_PUBLIC_MAP_TILES_URL,
  };
}

/** Lo que se enseña de una credencial que viene del entorno, sin descifrar nada. */
function pistaDeEntorno(valor: string, esSecreto: boolean): string {
  return esSecreto ? cred.enmascarar(valor) : valor;
}

export const cargarEstadoDeLaBoveda = cache(async (): Promise<EstadoDeLaBoveda> => {
  const entorno = entornoDeCredenciales();
  const hayClaveMaestra = Boolean(process.env.CREDENCIALES_CLAVE_MAESTRA);

  const guardadas: CredencialCifrada[] = esModoDemostracion() ? [] : await listCredenciales();
  const porClave = new Map(guardadas.map((c) => [c.clave, c]));

  const secciones = cred.porGrupo().map((seccion) => ({
    grupo: seccion.grupo,
    titulo: seccion.titulo,
    integraciones: seccion.integraciones.map((integracion) => {
      const campos: CampoConEstado[] = integracion.campos.map((campo) => {
        const enBoveda = porClave.get(campo.clave);
        if (enBoveda) return { campo, pista: enBoveda.pista, origen: 'boveda' as const };

        const delEntorno = entorno[campo.clave];
        if (delEntorno && delEntorno.trim() !== '') {
          return {
            campo,
            pista: pistaDeEntorno(delEntorno, campo.secreto),
            origen: 'entorno' as const,
          };
        }

        return { campo, pista: null, origen: null };
      });

      const conValor = new Set(campos.filter((c) => c.origen !== null).map((c) => c.campo.clave));
      const { configurada, faltan } = cred.estadoDeIntegracion(integracion, conValor);

      return { integracion, campos, configurada, faltan };
    }),
  }));

  return {
    secciones,
    hayClaveMaestra,
    bovedaDisponible: !esModoDemostracion() && hayClaveMaestra,
  };
});
