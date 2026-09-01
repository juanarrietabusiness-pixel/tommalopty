import { NextResponse } from 'next/server';
import {
  isWithinPanama,
  repartirDireccion,
  type DireccionAproximada,
  type PartesDeDireccion,
} from '@nebula/domain';
import { siteUrl } from '@/lib/site';

/**
 * Qué dirección hay en este punto.
 *
 * Es el camino inverso al de `/api/geo/buscar`: allí se escribe un texto y sale
 * una coordenada; aquí se marca un punto en el mapa y sale el texto. Sin esto,
 * quien compra colocaba el pin y **seguía teniendo que escribir la dirección a
 * mano**, que era justo el trabajo que el mapa venía a quitarle.
 *
 * Va por el servidor por los mismos dos motivos que el buscador: la política de
 * uso de Nominatim pide identificar la aplicación y limitar el ritmo, y aquí la
 * respuesta se cachea. Un punto del mapa se repite mucho más de lo que parece:
 * la misma esquina la marcan todos los vecinos de la manzana.
 */

// Node.js y no `edge`: el adaptador de Cloudflare (OpenNext) sirve el runtime de
// Node, y una ruta declarada `edge` se compila a un paquete que no sabe servir.
export const runtime = 'nodejs';

interface RespuestaNominatim {
  display_name?: string;
  address?: PartesDeDireccion;
}

export interface DireccionEnElPunto {
  direccion: DireccionAproximada | null;
}

/** Un día, igual que el buscador: las calles no se mueven. */
const CACHE_SEGUNDOS = 86_400;

/**
 * Nivel de detalle de la respuesta.
 *
 * 18 es «edificio». Pedir más devuelve el portal exacto y suena mejor de lo que
 * es: para un punto marcado con el dedo en un móvil, un número de casa deducido
 * con esa precisión es casi siempre el de la casa de al lado, y una dirección
 * equivocada con aire de exacta es peor que una vaga.
 */
const DETALLE = 18;

export async function GET(request: Request) {
  const parametros = new URL(request.url).searchParams;
  const lat = Number(parametros.get('lat'));
  const lng = Number(parametros.get('lng'));

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ direccion: null } satisfies DireccionEnElPunto, { status: 400 });
  }

  // Fuera de Panamá no se pregunta: la pantalla ya avisa de que el punto está
  // mal, y rellenar el formulario con una dirección de otro país sería peor que
  // dejarlo en blanco.
  if (!isWithinPanama({ lat, lng })) {
    return NextResponse.json({ direccion: null } satisfies DireccionEnElPunto);
  }

  const url = new URL('https://nominatim.openstreetmap.org/reverse');
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lon', String(lng));
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('zoom', String(DETALLE));
  url.searchParams.set('accept-language', 'es');

  const marca = process.env.NEXT_PUBLIC_BRAND_NAME ?? 'Nébula Store';

  try {
    const respuesta = await fetch(url, {
      headers: { 'User-Agent': `${marca} (${siteUrl()})`, Accept: 'application/json' },
      next: { revalidate: CACHE_SEGUNDOS },
    });

    if (!respuesta.ok) {
      return NextResponse.json({ direccion: null } satisfies DireccionEnElPunto, { status: 502 });
    }

    const crudo = (await respuesta.json()) as RespuestaNominatim;

    return NextResponse.json(
      {
        direccion: repartirDireccion(crudo.address, crudo.display_name ?? ''),
      } satisfies DireccionEnElPunto,
      { headers: { 'Cache-Control': `public, max-age=${CACHE_SEGUNDOS}` } },
    );
  } catch {
    // Que el geocodificador esté caído no puede impedir comprar: los campos se
    // quedan como estén y se escriben a mano, como hasta ahora.
    return NextResponse.json({ direccion: null } satisfies DireccionEnElPunto, { status: 502 });
  }
}
