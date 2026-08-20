import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase';

/**
 * Retorno de Supabase Auth (confirmación de email, magic link).
 * Canjea el código por una sesión y devuelve al visitante a donde estaba.
 */
/**
 * Solo se admiten rutas internas. Sin esta comprobación,
 * `?next=https://evil.com` redirige fuera del sitio a alguien que acaba de
 * iniciar sesión, que es el clásico open redirect para phishing.
 */
function safeRedirect(candidate: string | null): string {
  if (!candidate) return '/cuenta';
  // Debe empezar por una sola barra: `//evil.com` es una URL absoluta protocolo-relativa.
  if (!candidate.startsWith('/') || candidate.startsWith('//')) return '/cuenta';
  return candidate;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = safeRedirect(url.searchParams.get('next'));

  if (code) {
    const supabase = await getSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      return NextResponse.redirect(new URL('/entrar?error=auth_callback_failed', url.origin));
    }
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
