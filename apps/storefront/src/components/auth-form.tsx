'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { createSupabaseBrowserClient } from '@nebula/db';

/**
 * Alta e inicio de sesión con Supabase Auth.
 * El perfil y la ficha de CRM se crean solos por trigger en la base de datos.
 */
export function AuthForm({ mode }: { mode: 'login' | 'signup' }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') ?? '/cuenta';

  const [status, setStatus] = useState<'idle' | 'sending'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('sending');
    setError(null);
    setInfo(null);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get('email'));
    const password = String(formData.get('password'));

    try {
      const supabase = createSupabaseBrowserClient();

      if (mode === 'signup') {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: String(formData.get('fullName') ?? '') },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (signUpError) throw signUpError;

        setInfo('Cuenta creada. Revisa tu correo si te pedimos confirmarla.');
        router.refresh();
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;

      router.push(redirectTo);
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'No pudimos completar la operación. Inténtalo de nuevo.',
      );
    } finally {
      setStatus('idle');
    }
  }

  return (
    <div className="auth-layout">
      <div className="auth-card">
        <h1>{mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}</h1>
        <p>
          {mode === 'login'
            ? 'Accede para ver tus pedidos y direcciones guardadas.'
            : 'Crea tu cuenta para seguir tus pedidos y guardar favoritos.'}
        </p>

        {error ? <div className="notice notice-error">{error}</div> : null}
        {info ? <div className="notice notice-success">{info}</div> : null}

        <form onSubmit={handleSubmit}>
          {mode === 'signup' ? (
            <div className="field">
              <label htmlFor="fullName">Nombre completo</label>
              <input id="fullName" name="fullName" required />
            </div>
          ) : null}

          <div className="field">
            <label htmlFor="email">Correo electrónico</label>
            <input id="email" name="email" type="email" required autoComplete="email" />
          </div>

          <div className="field">
            <label htmlFor="password">Contraseña</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
            {mode === 'signup' ? <span className="field-hint">Mínimo 8 caracteres.</span> : null}
          </div>

          <button
            type="submit"
            className="btn btn-dark"
            style={{ width: '100%' }}
            disabled={status === 'sending'}
          >
            {status === 'sending' ? 'Procesando…' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
          </button>
        </form>

        <p className="auth-footer">
          {mode === 'login' ? (
            <>
              ¿No tienes cuenta? <Link href="/registro">Regístrate</Link>
            </>
          ) : (
            <>
              ¿Ya tienes cuenta? <Link href="/entrar">Inicia sesión</Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
