import { NextResponse } from 'next/server';
import { isWithinPanama, roundCoordinate } from '@nebula/domain';
import { siteUrl } from '@/lib/site';

/**
 * Buscador de direcciones.
 *
 * Es un intermediario delgado sobre Nominatim, el geocodificador de
 * OpenStreetMap. Podría llamarse desde el navegador, y no se hace por dos
 * motivos:
 *
 *  - Su política de uso pide identificar la aplicación y limitar el ritmo. Con
 *    una sola salida se cumple; con una por visitante, no.
 *  - Las respuestas se cachean aquí, así que las búsquedas repetidas —y en una
 *    tienda de un país lo son casi todas— no llegan a salir.
 *
 * Se devuelve lo mínimo que la pantalla necesita. La respuesta cruda de
 * Nominatim trae medio centenar de campos y ninguno más hace falta.
 */

export const runtime = 'edge';

interface ResultadoNominatim {
  lat?: string;
  lon?: string;
  display_name?: string;
}

export interface LugarEncontrado {
  etiqueta: string;
  lat: number;
  lng: number;
}

/** Un día. Una dirección no se mueve, y el catálogo de calles tampoco. */
const CACHE_SEGUNDOS = 86_400;

export async function GET(request: Request) {
  const consulta = new URL(request.url).searchParams.get('q')?.trim() ?? '';

  // Con menos de tres letras Nominatim devuelve media ciudad y la lista no
  // ayuda a nadie. Se corta aquí para no gastar la petición.
  if (consulta.length < 3) {
    return NextResponse.json({ resultados: [] satisfies LugarEncontrado[] });
  }

  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', consulta);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('countrycodes', 'pa');
  url.searchParams.set('limit', '6');
  url.searchParams.set('accept-language', 'es');

  const sitio = siteUrl();
  const marca = process.env.NEXT_PUBLIC_BRAND_NAME ?? 'Nébula Store';

  try {
    const respuesta = await fetch(url, {
      // La política de Nominatim pide poder identificar quién llama. Sin esto
      // la respuesta puede ser un 403 y nadie sabría por qué.
      headers: { 'User-Agent': `${marca} (${sitio})`, Accept: 'application/json' },
      next: { revalidate: CACHE_SEGUNDOS },
    });

    if (!respuesta.ok) {
      return NextResponse.json({ resultados: [] satisfies LugarEncontrado[] }, { status: 502 });
    }

    const crudos = (await respuesta.json()) as ResultadoNominatim[];

    const resultados: LugarEncontrado[] = [];

    for (const crudo of Array.isArray(crudos) ? crudos : []) {
      const lat = Number(crudo.lat);
      const lng = Number(crudo.lon);
      const etiqueta = crudo.display_name?.trim();

      if (!etiqueta) continue;
      // `countrycodes=pa` ya debería bastar, pero un punto fuera del país en una
      // lista de sugerencias acaba en una dirección imposible de repartir.
      if (!isWithinPanama({ lat, lng })) continue;

      resultados.push({
        etiqueta,
        lat: roundCoordinate(lat),
        lng: roundCoordinate(lng),
      });
    }

    return NextResponse.json(
      { resultados },
      { headers: { 'Cache-Control': `public, max-age=${CACHE_SEGUNDOS}` } },
    );
  } catch {
    // Que el buscador esté caído no puede impedir comprar: la pantalla sigue
    // dejando mover el pin a mano.
    return NextResponse.json({ resultados: [] satisfies LugarEncontrado[] }, { status: 502 });
  }
}
