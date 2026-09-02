import { credenciales as cred } from '@nebula/integrations';
import { listCredenciales } from '@nebula/db';
import { isSupabaseConfigured } from '@/lib/supabase';

/**
 * Los ajustes que viajan al navegador y que se pueden cambiar sin redesplegar.
 *
 * El problema concreto: `NEXT_PUBLIC_META_PIXEL_ID` se sustituye **en
 * compilación**, así que pegar el píxel en el panel no habría servido de nada
 * hasta el siguiente despliegue — y ese despliegue lo lanza un programador, que
 * es justo a quien la bóveda venía a quitar de en medio.
 *
 * Estos tres se leen en servidor y se pasan como props. Dejan de ser de
 * compilación y pasan a ser de petición.
 *
 * La variable de entorno sigue funcionando como respaldo: si no hay bóveda, o la
 * migración no está aplicada, todo se comporta como antes.
 */

export interface AjustesPublicos {
  metaPixelId: string | null;
  ga4MeasurementId: string | null;
  mapTilesUrl: string | null;
}

/**
 * Leer la bóveda en cada visita sería una consulta más por página, y estos
 * valores cambian una vez al año. Un minuto de memoria es un cambio que tarda
 * como mucho un minuto en verse, y ninguna consulta en la inmensa mayoría de las
 * peticiones.
 *
 * Vive en memoria del proceso a propósito: en Workers cada isolate tiene la
 * suya, así que lo peor que pasa es que dos servidores tarden distinto en verlo.
 */
const VIGENCIA_MS = 60_000;

let memoria: { valores: AjustesPublicos; expira: number } | null = null;

/** Escritas literales: Next solo sustituye `NEXT_PUBLIC_*` si se escribe así. */
function desdeElEntorno(): AjustesPublicos {
  const limpio = (valor: string | undefined) => (valor && valor.trim() !== '' ? valor : null);

  return {
    metaPixelId: limpio(process.env.NEXT_PUBLIC_META_PIXEL_ID),
    ga4MeasurementId: limpio(process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID),
    mapTilesUrl: limpio(process.env.NEXT_PUBLIC_MAP_TILES_URL),
  };
}

export async function ajustesPublicos(): Promise<AjustesPublicos> {
  const ahora = Date.now();
  if (memoria && memoria.expira > ahora) return memoria.valores;

  const entorno = desdeElEntorno();

  // Sin Supabase configurado —modo demostración— no hay bóveda que leer, y la
  // tienda tiene que seguir pintándose igual.
  if (!isSupabaseConfigured()) {
    memoria = { valores: entorno, expira: ahora + VIGENCIA_MS };
    return entorno;
  }

  let valores = entorno;

  try {
    const guardadas = await listCredenciales();
    const maestra = process.env.CREDENCIALES_CLAVE_MAESTRA;

    const resueltas = await cred.resolverCredenciales({
      guardadas: guardadas.map((c) => ({ clave: c.clave, valorCifrado: c.valorCifrado })),
      claveMaestra: maestra,
      entorno: {},
    });

    valores = {
      metaPixelId: resueltas.get('NEXT_PUBLIC_META_PIXEL_ID') ?? entorno.metaPixelId,
      ga4MeasurementId: resueltas.get('NEXT_PUBLIC_GA4_MEASUREMENT_ID') ?? entorno.ga4MeasurementId,
      mapTilesUrl: resueltas.get('NEXT_PUBLIC_MAP_TILES_URL') ?? entorno.mapTilesUrl,
    };
  } catch (error) {
    // Que la tienda no se pinte porque la bóveda no responde sería cambiar un
    // problema de configuración por una caída.
    console.warn('[ajustes] No se pudo leer la bóveda; se usa el entorno.', error);
  }

  memoria = { valores, expira: ahora + VIGENCIA_MS };
  return valores;
}
