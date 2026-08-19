import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase';

/**
 * Retorno de Supabase Auth (confirmación de email, magic link).
 * Canjea el código por una sesión y devuelve al visitante a donde estaba.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') ?? '/cuenta';

  if (code) {
    const supabase = await getSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      return NextResponse.redirect(new URL('/entrar?error=auth_callback_failed', url.origin));
    }
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
