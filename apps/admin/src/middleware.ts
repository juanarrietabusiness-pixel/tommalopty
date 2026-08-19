import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * Refresco de sesión en el borde.
 *
 * Nota de convención: Next 16 marca `middleware.ts` como obsoleto a favor de
 * `proxy.ts`, pero `proxy` solo corre en runtime Node y el adaptador de
 * Cloudflare Workers (@opennextjs/cloudflare) todavía no lo soporta. Mientras
 * eso no cambie, esta es la única forma de desplegar en Cloudflare, que es el
 * hosting elegido. Migrar a `proxy.ts` en cuanto el adaptador lo permita.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) return response;

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLoginRoute = request.nextUrl.pathname.startsWith('/entrar');

  if (!user && !isLoginRoute) {
    return NextResponse.redirect(new URL('/entrar', request.url));
  }

  if (user && isLoginRoute) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
