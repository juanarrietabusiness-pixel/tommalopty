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

  // Comprobación de rol, no solo de sesión (#12). Sin esto, un cliente de la
  // tienda con sesión iniciada pasaba el middleware; lo frenaban `PanelPage` y
  // RLS por debajo, pero el middleware daba la falsa impresión de cubrir el
  // panel entero, y la página que alguien añada sin `PanelPage` no tendría nada
  // que la protegiese. Aquí se convierte en la frontera que aparenta ser.
  //
  // La lista de admitidos es la misma que `entraAlPanel` en `lib/auth.ts`, en
  // vez de importarla, porque el middleware corre en el borde y no debe arrastrar
  // el código de servidor (react cache, next/navigation) de ese módulo.
  if (user && !isLoginRoute) {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('role, is_active')
      .eq('id', user.id)
      .maybeSingle();

    // Solo se bloquea con una respuesta **afirmativa** de que no es staff: un
    // perfil leído cuyo rol no entra al panel, o que está desactivado.
    //
    // Ni un error de la base ni una fila ausente cuentan como esa respuesta, y
    // la diferencia importa: si no, un fallo de red o una lectura que llega
    // antes de que la cookie de sesión esté asentada devuelven a un operador
    // legítimo a la pantalla de acceso, que es exactamente la fricción que se
    // intentaba quitar. En esos dos casos se deja pasar y deciden las capas de
    // abajo, que siguen ahí: `requireStaff` en `PanelPage` y RLS.
    const noEsStaff =
      !error &&
      profile != null &&
      (profile.is_active !== true ||
        (profile.role !== 'operator' && profile.role !== 'admin' && profile.role !== 'superadmin'));

    if (noEsStaff) {
      return NextResponse.redirect(new URL('/entrar?error=sin_permisos', request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
